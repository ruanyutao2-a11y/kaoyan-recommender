import { EvaluationInput, SchoolRecommendation, PreviewResult } from './types'

export function generateId(): string {
  return crypto.randomUUID()
}

export function generateRedeemCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function createEvaluation(
  db: D1Database,
  input: EvaluationInput
): Promise<string> {
  const id = generateId()
  await db
    .prepare(
      `INSERT INTO evaluations (id, school, major, gpa, target_major, region, english_level, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'processing')`
    )
    .bind(id, input.school, input.major, input.estimated_score || null, input.target_major, input.region || null, input.english_level || null)
    .run()
  return id
}

export async function updateEvaluationResult(
  db: D1Database,
  id: string,
  resultJson: string,
  previewJson: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE evaluations SET result_json = ?, preview_json = ?, status = 'completed' WHERE id = ?`
    )
    .bind(resultJson, previewJson, id)
    .run()
}

export async function getEvaluation(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM evaluations WHERE id = ?').bind(id).first()
}

export async function markEvaluationPaid(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`UPDATE evaluations SET is_paid = 1 WHERE id = ?`)
    .bind(id)
    .run()
}

export async function createOrder(
  db: D1Database,
  evaluationId: string,
  taobaoUrl: string
): Promise<{ orderId: string; redeemCode: string }> {
  const orderId = generateId()
  const redeemCode = generateRedeemCode()

  await db
    .prepare(
      `INSERT INTO orders (id, evaluation_id, status, taobao_url) VALUES (?, ?, 'created', ?)`
    )
    .bind(orderId, evaluationId, taobaoUrl)
    .run()

  const codeId = generateId()
  await db
    .prepare(
      `INSERT INTO redeem_codes (id, code, order_id) VALUES (?, ?, ?)`
    )
    .bind(codeId, redeemCode, orderId)
    .run()

  return { orderId, redeemCode }
}

export async function validateRedeemCode(
  db: D1Database,
  code: string
): Promise<{ valid: boolean; evaluationId?: string; message: string }> {
  const record = await db
    .prepare('SELECT * FROM redeem_codes WHERE code = ?')
    .bind(code.toUpperCase())
    .first()

  if (!record) {
    return { valid: false, message: '兑换码无效' }
  }
  // Type assertion for D1 result
  const redeemRecord = record as any
  if (redeemRecord.used_at) {
    return { valid: false, message: '此兑换码已被使用' }
  }

  // Mark as used
  await db
    .prepare('UPDATE redeem_codes SET used_at = datetime("now") WHERE code = ?')
    .bind(code.toUpperCase())
    .run()

  // Get associated order and mark as paid
  const order = await db
    .prepare('SELECT * FROM orders WHERE id = ?')
    .bind(redeemRecord.order_id)
    .first() as any

  if (order) {
    await db
      .prepare('UPDATE orders SET status = "paid", paid_at = datetime("now") WHERE id = ?')
      .bind(order.id)
      .run()
    await markEvaluationPaid(db, order.evaluation_id)
  }

  return {
    valid: true,
    evaluationId: order?.evaluation_id,
    message: '兑换成功',
  }
}

export async function getOrderByEvaluationId(db: D1Database, evaluationId: string) {
  return db
    .prepare('SELECT * FROM orders WHERE evaluation_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(evaluationId)
    .first()
}
