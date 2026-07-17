import { Context } from 'hono'
import { EvaluationInput } from './types'
import {
  createEvaluation,
  updateEvaluationResult,
  getEvaluation,
  createOrder,
  validateRedeemCode,
  getOrderByEvaluationId,
} from './db'
import { generateRecommendations } from './llm'

// Simple in-memory rate limiter (per Worker instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3600_000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
}

export async function handleEvaluate(c: Context) {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown'
  if (!checkRateLimit(ip)) {
    return c.json({ error: '请求过于频繁，请一小时后再试' }, 429)
  }

  const body = await c.req.json<EvaluationInput>()
  if (!body.school || !body.major || !body.target_major) {
    return c.json({ error: '请填写本科院校、本科专业和目标专业' }, 400)
  }

  const db = c.env.DB as D1Database
  const apiKey = c.env.DASHSCOPE_API_KEY as string

  try {
    const id = await createEvaluation(db, body)

    // Fire and forget? No, we need to wait for result.
    // But we can use ctx.waitUntil for background processing.
    // For MVP, we'll process synchronously since Claude is fast.
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const { result, preview } = await generateRecommendations(body, apiKey)
          await updateEvaluationResult(db, id, JSON.stringify(result), JSON.stringify(preview))
        } catch (err) {
          console.error('LLM evaluation failed:', err)
          await db
            .prepare("UPDATE evaluations SET status = 'failed' WHERE id = ?")
            .bind(id)
            .run()
        }
      })()
    )

    return c.json({ evaluationId: id, status: 'processing' }, 202)
  } catch (err: any) {
    console.error('Evaluate error:', err)
    return c.json({ error: '评估失败，请稍后重试' }, 500)
  }
}

export async function handleGetResult(c: Context) {
  const id = c.req.param('id')
  if (!id) {
    return c.json({ error: '缺少评估 ID' }, 400)
  }
  const db = c.env.DB as D1Database

  const evaluation = await getEvaluation(db, id) as any
  if (!evaluation) {
    return c.json({ error: '评估记录不存在' }, 404)
  }

  if (evaluation.status === 'processing') {
    return c.json({ status: 'processing' })
  }

  if (evaluation.status === 'failed') {
    return c.json({ error: '评估失败，请重新提交' }, 500)
  }

  const result = JSON.parse(evaluation.result_json || '{}')
  const preview = JSON.parse(evaluation.preview_json || '{}')

  if (evaluation.is_paid) {
    return c.json({
      status: 'completed',
      isPaid: true,
      data: result,
    })
  }

  return c.json({
    status: 'completed',
    isPaid: false,
    data: preview,
  })
}

export async function handleCreateOrder(c: Context) {
  const body = await c.req.json<{ evaluationId: string }>()
  if (!body.evaluationId) {
    return c.json({ error: '缺少 evaluationId' }, 400)
  }

  const db = c.env.DB as D1Database
  const taobaoUrl = (c.env.TAOBAO_PRODUCT_URL as string) || 'https://item.taobao.com/item.htm?id=XXXXX'

  try {
    const { orderId, redeemCode } = await createOrder(db, body.evaluationId, taobaoUrl)

    return c.json({
      orderId,
      taobaoUrl,
      redeemCode,
      message: '请在淘宝完成付款后，使用兑换码解锁完整结果',
    })
  } catch (err: any) {
    console.error('Create order error:', err)
    return c.json({ error: '创建订单失败' }, 500)
  }
}

export async function handleRedeem(c: Context) {
  const body = await c.req.json<{ code: string }>()
  if (!body.code || body.code.trim().length === 0) {
    return c.json({ error: '请输入兑换码' }, 400)
  }

  const db = c.env.DB as D1Database

  try {
    const result = await validateRedeemCode(db, body.code.trim())
    if (!result.valid) {
      return c.json({ error: result.message }, 400)
    }

    const evaluation = await getEvaluation(db, result.evaluationId!) as any
    const fullResult = JSON.parse(evaluation.result_json || '{}')

    return c.json({
      success: true,
      message: result.message,
      evaluationId: result.evaluationId,
      data: fullResult,
    })
  } catch (err: any) {
    console.error('Redeem error:', err)
    return c.json({ error: '兑换失败，请稍后重试' }, 500)
  }
}

export async function handleTaobaoCallback(c: Context) {
  // Taobao Open Platform webhook endpoint
  // Receives payment notification from Taobao when user pays
  const body = await c.req.text()
  console.log('Taobao callback received:', body)

  // TODO: Verify Taobao signature and extract order info
  // For MVP, this is a placeholder that logs the callback
  // Manual redeem code entry serves as fallback

  return c.json({ success: true })
}
