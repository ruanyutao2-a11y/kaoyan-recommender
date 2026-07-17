import { EvaluationInput, EvaluationResult, PreviewResult, SchoolRecommendation } from './types'

const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

const SYSTEM_PROMPT = `你是一位资深考研择校顾问。你拥有中国所有研究生院招生信息的专业知识。

根据用户提供的背景信息，推荐 9 所考研院校，分为三个梯度：
- 冲刺院校（3所）：有一定难度，需要付出较大努力，但不是完全不可能
- 稳妥院校（3所）：与用户背景匹配度较高，正常努力即可
- 保底院校（3所）：录取把握较大

对每所学校，提供：
1. 学校名称
2. 匹配分数（1-100）
3. 推荐理由（50字以内）
4. 风险提示（30字以内）
5. 建议关注的考试科目（2-4门）
6. 预估分数线参考
7. 补充说明
8. 本科歧视程度：低/中/高（该校是否对考研学生本科出身有明显歧视）
9. 上岸难度：极难/较难/中等/较易（基于报录比、分数线、复试淘汰率综合评估）

最后给出整体评估总结（100字以内）。

所有推荐必须标注"AI 生成，仅供参考"。推荐理由需具体，不要泛泛而谈。`

export function buildUserPrompt(input: EvaluationInput): string {
  const parts = [
    `请根据以下背景信息推荐考研院校：`,
    `- 本科院校：${input.school}`,
    `- 本科专业：${input.major}`,
  ]
  if (input.estimated_score) parts.push(`- 预估考研分数：${input.estimated_score}`)
  parts.push(`- 目标专业：${input.target_major}`)
  if (input.region) parts.push(`- 意向地区：${input.region}`)
  if (input.english_level) parts.push(`- 英语水平：${input.english_level}`)

  parts.push(``)
  parts.push(`请严格按照以下 JSON 格式返回（不要包含 markdown 代码块标记）：`)
  parts.push(`{
  "summary": {
    "total_schools": 9,
    "tier_counts": { "冲刺": 3, "稳妥": 3, "保底": 3 },
    "overall_assessment": "整体评估文字"
  },
  "recommendations": [
    {
      "name": "学校名称",
      "tier": "冲刺",
      "match_score": 85,
      "reason": "推荐理由",
      "risk_warning": "风险提示",
      "exam_subjects": ["科目1", "科目2", "科目3"],
      "estimate_score": "预估分数线",
      "notes": "补充说明",
      "discrimination": "低",
      "difficulty": "较难"
    }
  ],
  "disclaimer": "AI 生成，仅供参考。具体招生信息请以各校研究生院官网发布为准。"
}`)

  return parts.join('\n')
}

export async function generateRecommendations(
  input: EvaluationInput,
  apiKey: string
): Promise<{ result: EvaluationResult; preview: PreviewResult }> {
  const userPrompt = buildUserPrompt(input)

  const response = await fetch(DASHSCOPE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4096,
      enable_search: true,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`DashScope API error: ${response.status} ${errText}`)
  }

  const data = await response.json() as any
  // OpenAI-compatible format: choices[0].message.content
  const content = data.choices[0].message.content

  // Parse JSON from response (handle possible markdown wrapping)
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  const result: EvaluationResult = JSON.parse(jsonStr)

  // Ensure disclaimer is present
  if (!result.disclaimer) {
    result.disclaimer = 'AI 生成，仅供参考。具体招生信息请以各校研究生院官网发布为准。'
  }

  // Build preview: summary + first school only
  const preview: PreviewResult = {
    summary: {
      total_schools: result.summary.total_schools,
      tier_counts: result.summary.tier_counts,
    },
    preview_school: result.recommendations[0],
    locked_count: result.recommendations.length - 1,
  }

  return { result, preview }
}
