import { Context } from 'hono'
import { EvaluationInput, PaymentSubmission } from './types'
import {
  createEvaluation,
  updateEvaluationResult,
  getEvaluation,
  submitPayment,
  getOrdersForReview,
  approveOrder,
  rejectOrder,
  getPendingOrderByEvaluation,
  getPaidDeviceCount,
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

function checkAdminAuth(c: Context): boolean {
  const password = c.req.header('X-Admin-Password')
  const expected = c.env.ADMIN_PASSWORD as string | undefined
  if (!expected) {
    console.error('ADMIN_PASSWORD secret is not set!')
    return false
  }
  return password === expected
}

export async function handleEvaluate(c: Context) {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown'
  if (!checkRateLimit(ip)) {
    return c.json({ error: '请求过于频繁，请一小时后再试' }, 429)
  }

  let body: EvaluationInput & { deviceId?: string }
  try {
    body = await c.req.json<EvaluationInput & { deviceId?: string }>()
  } catch {
    return c.json({ error: '请求格式错误' }, 400)
  }
  if (!body.school || !body.major || !body.target_major) {
    return c.json({ error: '请填写本科院校、本科专业和目标专业' }, 400)
  }

  // Process LLM synchronously — worker waits for the API call to complete.
  // Cloudflare Worker paid plan has 30s CPU limit; free plan 10ms.
  // If your worker is on free plan, this will need to switch to a queue-based approach.
  const db = c.env.DB as D1Database
  const apiKey = c.env.DASHSCOPE_API_KEY as string

  const deviceId = body.deviceId || ''
  const isFirstTime = deviceId ? (await getPaidDeviceCount(db, deviceId)) === 0 : true
  const id = await createEvaluation(db, body, isFirstTime)

  try {
    const { result, preview } = await generateRecommendations(body, apiKey)
    await updateEvaluationResult(db, id, JSON.stringify(result), JSON.stringify(preview))
    return c.json({ evaluationId: id, status: 'completed', isFree: isFirstTime, data: result })
  } catch (err) {
    console.error('LLM evaluation failed:', err)
    await db.prepare("UPDATE evaluations SET status = 'failed' WHERE id = ?").bind(id).run()
    return c.json({ error: 'AI 评估失败，请返回首页重新提交' }, 500)
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
    return c.json({ error: 'AI 评估失败，请返回首页重新提交' }, 500)
  }

  let result: any = {}
  let preview: any = {}
  try {
    result = JSON.parse(evaluation.result_json || '{}')
  } catch {
    console.error('Corrupt result_json for evaluation:', id)
  }
  try {
    preview = JSON.parse(evaluation.preview_json || '{}')
  } catch {
    console.error('Corrupt preview_json for evaluation:', id)
  }

  // If result_json was corrupt (e.g. stored LLM error text), treat as failed
  if (evaluation.status === 'completed' && !result.recommendations && !preview.preview_school) {
    return c.json({ error: 'AI 评估失败，请返回首页重新提交' }, 500)
  }

  // Already paid → return full result
  if (evaluation.is_paid) {
    return c.json({
      status: 'completed',
      isPaid: true,
      data: result,
    })
  }

  // Check free period
  if (evaluation.free_until) {
    const freeUntil = new Date(evaluation.free_until)
    if (freeUntil > new Date()) {
      // Still within free window → return full result
      return c.json({
        status: 'completed',
        isPaid: false,
        isFree: true,
        freeUntil: evaluation.free_until,
        data: result,
      })
    }
  }

  // Free window expired, not paid → return preview
  return c.json({
    status: 'completed',
    isPaid: false,
    isFree: false,
    data: preview,
  })
}

export async function handleSubmitPayment(c: Context) {
  const body = await c.req.json<PaymentSubmission>()
  if (!body.evaluationId || !body.txnRef) {
    return c.json({ error: '缺少 evaluationId 或转账单号' }, 400)
  }

  const db = c.env.DB as D1Database

  try {
    // Check if already has a pending/paid order for this evaluation
    const existing = await getPendingOrderByEvaluation(db, body.evaluationId) as any
    if (existing) {
      if (existing.status === 'paid') {
        return c.json({ success: true, message: '已完成支付' })
      }
      return c.json({ success: true, message: '已提交，等待审核' })
    }

    const { orderId } = await submitPayment(
      db,
      body.evaluationId,
      body.txnRef,
      body.deviceId || ''
    )

    return c.json({
      success: true,
      orderId,
      message: '已提交付款信息，等待管理员审核',
    })
  } catch (err: any) {
    console.error('Submit payment error:', err)
    return c.json({ error: '提交失败，请稍后重试' }, 500)
  }
}

export async function handleAdminOrders(c: Context) {
  if (!checkAdminAuth(c)) {
    return c.json({ error: '密码错误' }, 401)
  }

  const db = c.env.DB as D1Database
  const status = c.req.query('status') || 'created'

  try {
    const result = await getOrdersForReview(db, status)
    return c.json({ orders: result.results || [] })
  } catch (err: any) {
    console.error('Admin orders error:', err)
    return c.json({ error: '查询失败' }, 500)
  }
}

export async function handleAdminApprove(c: Context) {
  if (!checkAdminAuth(c)) {
    return c.json({ error: '密码错误' }, 401)
  }

  const body = await c.req.json<{ orderId: string; action: 'approve' | 'reject'; notes?: string }>()
  if (!body.orderId || !body.action) {
    return c.json({ error: '缺少 orderId 或 action' }, 400)
  }

  const db = c.env.DB as D1Database

  try {
    if (body.action === 'approve') {
      const result = await approveOrder(db, body.orderId, 'admin')
      return c.json({ success: true, evaluationId: result.evaluationId })
    } else {
      await rejectOrder(db, body.orderId, 'admin', body.notes)
      return c.json({ success: true })
    }
  } catch (err: any) {
    console.error('Admin approve error:', err)
    return c.json({ error: '操作失败' }, 500)
  }
}

export async function handleCheckPaymentStatus(c: Context) {
  const id = c.req.param('evaluationId')
  if (!id) {
    return c.json({ error: '缺少 evaluationId' }, 400)
  }

  const db = c.env.DB as D1Database

  const order = await getPendingOrderByEvaluation(db, id) as any
  if (!order) {
    return c.json({ paid: false, status: 'none' })
  }

  return c.json({
    paid: order.status === 'paid',
    status: order.status,
  })
}
