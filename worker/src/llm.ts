import { EvaluationInput, EvaluationResult, PreviewResult, SchoolRecommendation } from './types'

const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

const SYSTEM_PROMPT = `现在是2026年7月，用户正在准备2027年考研（2026年12月初试，2027年3-4月复试）。你需要联网搜索各校近3年（2024-2026）的实际招生数据。

你是一位资深考研择校顾问。根据用户提供的背景信息，联网搜索并推荐 9 所考研院校，分为三个梯度：

冲刺院校（3所）：有一定难度，需要付出较大努力，但不是完全不可能
稳妥院校（3所）：与用户背景匹配度较高，正常努力即可
保底院校（3所）：录取把握较大

对每所学校，必须联网搜索后提供真实数据：
1. 学校名称
2. 匹配分数（1-100）
3. 推荐理由（50字以内，须引用真实数据）
4. 风险提示（30字以内，须引用实际报录比或分数线趋势）
5. 建议关注的考试科目（2-4门，须与该校实际初试科目一致）
6. 预估分数线参考（基于近3年数据趋势推算27考研）
7. 补充说明
8. 本科歧视程度：低/中/高
9. 上岸难度：极难/较难/中等/较易

重要：
- 所有数据必须来自近3年（2024-2026）官方研招网/学校官网
- 分数线必须标注是哪一年的数据，如"2026年复试线340"
- 如果没有搜到最新数据，请标注"数据待核实"
- 绝对不能编造数据
- 考试科目必须与该校研究生院官网一致

最后给出整体评估总结（100字以内）。所有推荐必须标注"AI 生成，仅供参考"。`

export function buildUserPrompt(input: EvaluationInput): string {
  const parts = [
    `请根据以下背景信息推荐考研院校（27考研，即2026年12月初试）：`,
    `- 本科院校：${input.school}`,
    `- 本科专业：${input.major}`,
  ]
  if (input.estimated_score) parts.push(`- 预估考研分数：${input.estimated_score}`)
  parts.push(`- 目标专业：${input.target_major}`)
  if (input.region) parts.push(`- 意向地区：${input.region}`)
  if (input.english_level) parts.push(`- 英语水平：${input.english_level}`)

  parts.push(``)
  parts.push(`请联网搜索各校近3年（2024-2026）的复试分数线、报录比、招生人数等真实数据，基于数据趋势推算27考研分数线。务必引用具体年份的数据。`)
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
      "reason": "推荐理由（含真实数据）",
      "risk_warning": "风险提示（含报录比/分数线趋势）",
      "exam_subjects": ["科目1", "科目2", "科目3"],
      "estimate_score": "2027预估分数线（基于24-26年数据趋势）",
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
      model: 'qwen-max',
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

  // Clean common LLM response noise before trying to parse
  let jsonStr = content.trim()
  // Strip markdown code fences
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  // If response starts with explanatory text, find the first '{'
  const braceIdx = jsonStr.indexOf('{')
  if (braceIdx > 0) {
    jsonStr = jsonStr.slice(braceIdx)
  }
  // If response has trailing text after the last '}', cut it
  const lastBrace = jsonStr.lastIndexOf('}')
  if (lastBrace > 0 && lastBrace < jsonStr.length - 1) {
    jsonStr = jsonStr.slice(0, lastBrace + 1)
  }
  jsonStr = jsonStr.trim()

  let result: EvaluationResult
  try {
    result = JSON.parse(jsonStr)
  } catch {
    console.error('Failed to parse LLM JSON response:', jsonStr.slice(0, 300))
    throw new Error('AI 响应格式异常，请返回首页重新提交')
  }

  // Validate that recommendations exist and are non-empty
  if (!result.recommendations || result.recommendations.length === 0) {
    console.error('LLM returned empty recommendations:', jsonStr.slice(0, 300))
    throw new Error('AI 未能生成有效推荐，请返回首页重新提交')
  }

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
