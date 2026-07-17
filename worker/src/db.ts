import { EvaluationInput } from './types'

export function generateId(): string {
  return crypto.randomUUID()
}

export async function createEvaluation(
  db: D1Database,
  input: EvaluationInput
): Promise<string> {
  const id = generateId()
  const freeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await db
    .prepare(
      `INSERT INTO evaluations (id, school, major, gpa, target_major, region, english_level, status, free_until, unlock_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', ?, 'free')`
    )
    .bind(id, input.school, input.major, input.estimated_score || null, input.target_major, input.region || null, input.english_level || null, freeUntil)
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
    .prepare(`UPDATE evaluations SET is_paid = 1, unlock_type = 'paid', free_until = NULL WHERE id = ?`)
    .bind(id)
    .run()
}

// ---- Payment submission (replaces old createOrder + redeem flow) ----

export async function submitPayment(
  db: D1Database,
  evaluationId: string,
  txnRef: string,
  deviceId: string
): Promise<{ orderId: string; autoApproved: boolean }> {
  const orderId = generateId()

  const paidCount = await getPaidDeviceCount(db, deviceId)
  const autoApproved = paidCount === 0
  const status = autoApproved ? 'paid' : 'created'

  await db
    .prepare(
      `INSERT INTO orders (id, evaluation_id, status, txn_ref, device_id, paid_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      orderId,
      evaluationId,
      status,
      txnRef,
      deviceId,
      autoApproved ? new Date().toISOString() : null
    )
    .run()

  if (autoApproved) {
    await markEvaluationPaid(db, evaluationId)
  }

  return { orderId, autoApproved }
}

export async function getPaidDeviceCount(db: D1Database, deviceId: string): Promise<number> {
  if (!deviceId) return 0
  const result = await db
    .prepare("SELECT COUNT(*) as cnt FROM orders WHERE device_id = ? AND status = 'paid'")
    .bind(deviceId)
    .first()
  return (result as any)?.cnt || 0
}

// ---- Admin functions ----

export async function getOrdersForReview(
  db: D1Database,
  statusFilter: string = 'created'
) {
  if (statusFilter === 'all') {
    return db
      .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100")
      .all()
  }
  return db
    .prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 100")
    .bind(statusFilter)
    .all()
}

export async function approveOrder(
  db: D1Database,
  orderId: string,
  reviewedBy: string
): Promise<{ evaluationId: string }> {
  const now = new Date().toISOString()
  await db
    .prepare(
      `UPDATE orders SET status = 'paid', paid_at = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`
    )
    .bind(now, reviewedBy, now, orderId)
    .run()

  const order = await db
    .prepare('SELECT evaluation_id FROM orders WHERE id = ?')
    .bind(orderId)
    .first() as any

  if (order) {
    await markEvaluationPaid(db, order.evaluation_id)
  }

  return { evaluationId: order?.evaluation_id }
}

export async function rejectOrder(
  db: D1Database,
  orderId: string,
  reviewedBy: string,
  notes?: string
): Promise<void> {
  const now = new Date().toISOString()
  await db
    .prepare(
      `UPDATE orders SET status = 'cancelled', reviewed_by = ?, reviewed_at = ?, notes = ? WHERE id = ?`
    )
    .bind(reviewedBy, now, notes || null, orderId)
    .run()
}

export async function getPendingOrderByEvaluation(
  db: D1Database,
  evaluationId: string
) {
  return db
    .prepare(
      "SELECT * FROM orders WHERE evaluation_id = ? AND (status = 'created' OR status = 'paid') ORDER BY created_at DESC LIMIT 1"
    )
    .bind(evaluationId)
    .first()
}
