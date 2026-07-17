# Payment Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken "pre-generate redeem code before payment" flow with "first-time free + payment with manual review" using personal WeChat/Alipay QR codes.

**Architecture:** Two-pronged approach — free tier gated by a 24h window (`free_until`), paid tier gated by admin review of user-submitted transaction references. Device fingerprinting (localStorage `device_id`) determines first-pay auto-unlock vs subsequent manual review. Backend API shifts from redeem-code validation to order submission + admin approval.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS (frontend), Cloudflare Workers + Hono + D1 (backend)

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-17-payment-redesign.md`
- No external payment gateway dependency — personal QR code images
- ADMIN_PASSWORD stored as Worker secret
- Device fingerprint via localStorage `device_id` for first-pay trust
- 24h free window from evaluation creation time

---

## File Structure Map

| File | Action | Responsibility |
|------|--------|----------------|
| `worker/schema.sql` | Modify | Add migration DDL for new columns |
| `worker/src/db.ts` | Modify | Add/update DB functions: submit payment, admin queries, free-period checks |
| `worker/src/routes.ts` | Modify | Rewrite order creation, result gating; add submit-payment, admin endpoints; remove redeem |
| `worker/src/index.ts` | Modify | Update route registrations |
| `worker/src/types.ts` | Modify | Add new type interfaces |
| `worker/wrangler.toml` | Modify | Add ADMIN_PASSWORD placeholder |
| `src/types/index.ts` | Modify | Add new frontend type interfaces |
| `src/lib/api.ts` | Modify | Add submitPayment, admin API methods; remove redeem |
| `src/components/Paywall.tsx` | Rewrite | QR code display + txn ref input + polling unlock |
| `src/pages/PreviewPage.tsx` | Modify | Check free period, bypass paywall if within window |
| `src/pages/AdminPage.tsx` | Create | Password-gated order review dashboard |
| `src/pages/RedeemPage.tsx` | Delete | No longer needed |
| `src/App.tsx` | Modify | Remove RedeemPage route, add AdminPage route |
| `public/qr-alipay.png` | Create | Placeholder for Alipay QR code |
| `public/qr-wechat.png` | Create | Placeholder for WeChat QR code |

---

### Task 1: Database Migration

**Files:**
- Modify: `worker/schema.sql` (append migration)

**Interfaces:**
- Produces: New columns on `evaluations` and `orders` tables (see DDL below)

- [ ] **Step 1: Append migration DDL to schema.sql**

```sql
-- Migration: payment redesign (2026-07-17)
-- New columns for free-tier + manual review flow

ALTER TABLE evaluations ADD COLUMN free_until TEXT;
ALTER TABLE evaluations ADD COLUMN unlock_type TEXT DEFAULT 'free';

ALTER TABLE orders ADD COLUMN txn_ref TEXT;
ALTER TABLE orders ADD COLUMN device_id TEXT;
ALTER TABLE orders ADD COLUMN reviewed_by TEXT;
ALTER TABLE orders ADD COLUMN reviewed_at TEXT;
ALTER TABLE orders ADD COLUMN notes TEXT;
```

- [ ] **Step 2: Run the migration against D1**

```bash
cd worker && npx wrangler d1 execute kaoyan-db --file=./schema.sql
```

Expected: `OK` / success message for each ALTER statement.

- [ ] **Step 3: Commit**

```bash
git add worker/schema.sql
git commit -m "feat(db): add free_until, unlock_type, txn_ref, device_id columns for payment redesign"
```

---

### Task 2: Update Backend Types

**Files:**
- Modify: `worker/src/types.ts`

**Interfaces:**
- Produces: `PaymentSubmission`, `AdminOrdersQuery`, `AdminApproveRequest` types

- [ ] **Step 1: Add new type definitions**

Replace the contents of `worker/src/types.ts` with:

```typescript
export interface EvaluationInput {
  school: string
  major: string
  estimated_score?: string
  target_major: string
  region?: string
  english_level?: string
}

export interface SchoolRecommendation {
  name: string
  tier: '冲刺' | '稳妥' | '保底'
  match_score: number
  reason: string
  risk_warning: string
  exam_subjects: string[]
  estimate_score: string
  notes: string
  /** 对本科院校的歧视程度: 低/中/高 */
  discrimination: '低' | '中' | '高'
  /** 上岸难度: 极难/较难/中等/较易 */
  difficulty: "极难" | "较难" | "中等" | "较易"
}

export interface EvaluationResult {
  summary: {
    total_schools: number
    tier_counts: { 冲刺: number; 稳妥: number; 保底: number }
    overall_assessment: string
  }
  recommendations: SchoolRecommendation[]
  disclaimer: string
}

export interface PreviewResult {
  summary: Pick<EvaluationResult['summary'], 'total_schools' | 'tier_counts'>
  preview_school: SchoolRecommendation
  locked_count: number
}

export interface OrderRecord {
  id: string
  evaluation_id: string
  status: 'created' | 'paid' | 'cancelled'
  amount: number
  taobao_url: string
  txn_ref: string | null
  device_id: string | null
  created_at: string
  paid_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
}

export interface RedeemCodeRecord {
  id: string
  code: string
  order_id: string
  used_at: string | null
  created_at: string
}

export interface PaymentSubmission {
  evaluationId: string
  txnRef: string
  deviceId: string
}

export interface AdminOrdersQuery {
  status?: 'created' | 'paid' | 'cancelled' | 'all'
}

export interface AdminApproveRequest {
  orderId: string
  action: 'approve' | 'reject'
  notes?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/types.ts
git commit -m "feat(worker): add PaymentSubmission, AdminOrdersQuery, AdminApproveRequest types"
```

---

### Task 3: Update Database Functions

**Files:**
- Modify: `worker/src/db.ts`

**Interfaces:**
- Consumes: Types from Task 2
- Produces: `submitPayment()`, `getOrdersForReview()`, `approveOrder()`, `rejectOrder()`, `getPaidDeviceCount()`, updated `getEvaluation()`

- [ ] **Step 1: Add new database functions**

Replace the contents of `worker/src/db.ts` with:

```typescript
import { EvaluationInput } from './types'

export function generateId(): string {
  return crypto.randomUUID()
}

export async function createEvaluation(
  db: D1Database,
  input: EvaluationInput
): Promise<string> {
  const id = generateId()
  // Set free_until to 24 hours from now
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

  // Check if this device has any previously paid orders
  const paidCount = await getPaidDeviceCount(db, deviceId)

  // First payment from this device → auto-approve
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
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/db.ts
git commit -m "feat(db): replace redeem-code flow with payment submission + admin review functions"
```

---

### Task 4: Rewrite Backend Routes

**Files:**
- Modify: `worker/src/routes.ts`

**Interfaces:**
- Consumes: DB functions from Task 3, types from Task 2
- Produces: Updated `handleGetResult`, `handleCreateOrder` → `handleSubmitPayment`, new `handleAdminOrders`, `handleAdminApprove`; removes `handleRedeem`

- [ ] **Step 1: Rewrite routes.ts**

Replace the contents of `worker/src/routes.ts` with:

```typescript
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
  const expected = (c.env.ADMIN_PASSWORD as string) || 'admin123'
  return password === expected
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

    c.executionCtx.waitUntil(
      (async () => {
        try {
          const { result, preview } = await generateRecommendations(body, apiKey)
          await updateEvaluationResult(db, id, JSON.stringify(result), JSON.stringify(preview))
        } catch (err) {
          console.error('LLM evaluation failed:', err)
          try {
            await db
              .prepare("UPDATE evaluations SET status = 'failed' WHERE id = ?")
              .bind(id)
              .run()
          } catch (dbErr) {
            console.error('Failed to update evaluation status:', dbErr)
          }
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
    return c.json({ error: 'AI 评估失败，请返回首页重新提交' }, 500)
  }

  const result = JSON.parse(evaluation.result_json || '{}')
  const preview = JSON.parse(evaluation.preview_json || '{}')

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
        return c.json({ success: true, autoApproved: true, message: '已完成支付' })
      }
      return c.json({ success: true, autoApproved: false, message: '已提交，等待审核' })
    }

    const { orderId, autoApproved } = await submitPayment(
      db,
      body.evaluationId,
      body.txnRef,
      body.deviceId || ''
    )

    return c.json({
      success: true,
      orderId,
      autoApproved,
      message: autoApproved ? '支付验证通过，已解锁全部内容' : '已提交付款信息，等待管理员审核',
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
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes.ts
git commit -m "feat(routes): replace redeem flow with submit-payment, admin orders, free-period gating"
```

---

### Task 5: Update Worker Entry Point

**Files:**
- Modify: `worker/src/index.ts`

**Interfaces:**
- Consumes: Route handlers from Task 4

- [ ] **Step 1: Update route registrations**

Replace the contents of `worker/src/index.ts` with:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  handleEvaluate,
  handleGetResult,
  handleSubmitPayment,
  handleAdminOrders,
  handleAdminApprove,
  handleCheckPaymentStatus,
} from './routes'

const app = new Hono()

app.use('*', cors({
  origin: [
    'http://localhost:5173',
    'https://ee582540.kaoyan-recommender.pages.dev',
    'https://39cefbdb.kaoyan-recommender.pages.dev',
  ],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Admin-Password'],
}))

app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.post('/api/evaluate', handleEvaluate)
app.get('/api/result/:id', handleGetResult)
app.post('/api/submit-payment', handleSubmitPayment)
app.get('/api/payment-status/:evaluationId', handleCheckPaymentStatus)
app.get('/api/admin/orders', handleAdminOrders)
app.post('/api/admin/approve', handleAdminApprove)

export default app
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): register new routes, add X-Admin-Password to CORS headers"
```

---

### Task 6: Update Wrangler Config

**Files:**
- Modify: `worker/wrangler.toml`

- [ ] **Step 1: Add ADMIN_PASSWORD placeholder**

Add to the end of `worker/wrangler.toml`:

```toml
# Set via: npx wrangler secret put ADMIN_PASSWORD
# (also add ADMIN_PASSWORD to .dev.vars for local dev)
```

- [ ] **Step 2: Create .dev.vars for local development**

Create `worker/.dev.vars`:

```
ADMIN_PASSWORD=admin123
DASHSCOPE_API_KEY=your-key-here
```

- [ ] **Step 3: Set secret on deployed worker**

```bash
cd worker && npx wrangler secret put ADMIN_PASSWORD
```

- [ ] **Step 4: Commit**

```bash
git add worker/wrangler.toml worker/.dev.vars
git commit -m "feat(worker): add ADMIN_PASSWORD secret config"
```

---

### Task 7: Update Frontend Types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `SubmitPaymentResponse`, `PaymentStatusResponse`, `AdminOrdersResponse`; removes `OrderResponse`, `RedeemResponse`

- [ ] **Step 1: Update type definitions**

Replace the contents of `src/types/index.ts` with:

```typescript
export interface EvaluationInput {
  school: string
  major: string
  estimated_score?: string
  target_major: string
  region?: string
  english_level?: string
}

export interface SchoolRecommendation {
  name: string
  tier: '冲刺' | '稳妥' | '保底'
  match_score: number
  reason: string
  risk_warning: string
  exam_subjects: string[]
  estimate_score: string
  notes: string
  discrimination: '低' | '中' | '高'
  difficulty: "极难" | "较难" | "中等" | "较易"
}

export interface EvaluationResult {
  summary: {
    total_schools: number
    tier_counts: { 冲刺: number; 稳妥: number; 保底: number }
    overall_assessment: string
  }
  recommendations: SchoolRecommendation[]
  disclaimer: string
}

export interface PreviewResult {
  summary: Pick<EvaluationResult['summary'], 'total_schools' | 'tier_counts'>
  preview_school: SchoolRecommendation
  locked_count: number
}

export type EvaluationStatus = 'created' | 'processing' | 'completed' | 'failed'

export interface EvaluateResponse {
  evaluationId: string
  status: EvaluationStatus
}

export interface ResultResponse {
  status: EvaluationStatus
  isPaid: boolean
  isFree?: boolean
  freeUntil?: string
  data: PreviewResult | EvaluationResult
}

export interface SubmitPaymentResponse {
  success: boolean
  orderId: string
  autoApproved: boolean
  message: string
}

export interface PaymentStatusResponse {
  paid: boolean
  status: 'none' | 'created' | 'paid' | 'cancelled'
}

export interface AdminOrder {
  id: string
  evaluation_id: string
  status: string
  amount: number
  txn_ref: string | null
  device_id: string | null
  created_at: string
  paid_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string | null
}

export interface AdminOrdersResponse {
  orders: AdminOrder[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add SubmitPayment, PaymentStatus, AdminOrder types; remove old Order/Redeem types"
```

---

### Task 8: Update Frontend API Client

**Files:**
- Modify: `src/lib/api.ts`

**Interfaces:**
- Consumes: Types from Task 7
- Produces: Updated `api` object with new methods

- [ ] **Step 1: Update API client**

Replace the contents of `src/lib/api.ts` with:

```typescript
import type {
  EvaluationInput,
  EvaluateResponse,
  ResultResponse,
  SubmitPaymentResponse,
  PaymentStatusResponse,
  AdminOrdersResponse,
} from '../types'

const API_BASE = ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`)
  }

  return data as T
}

export const api = {
  evaluate(input: EvaluationInput): Promise<EvaluateResponse> {
    return request<EvaluateResponse>('/api/evaluate', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  getResult(id: string): Promise<ResultResponse> {
    return request<ResultResponse>(`/api/result/${id}`)
  },

  submitPayment(evaluationId: string, txnRef: string, deviceId: string): Promise<SubmitPaymentResponse> {
    return request<SubmitPaymentResponse>('/api/submit-payment', {
      method: 'POST',
      body: JSON.stringify({ evaluationId, txnRef, deviceId }),
    })
  },

  getPaymentStatus(evaluationId: string): Promise<PaymentStatusResponse> {
    return request<PaymentStatusResponse>(`/api/payment-status/${evaluationId}`)
  },

  // Admin APIs — pass password via header
  getAdminOrders(status: string, password: string): Promise<AdminOrdersResponse> {
    return request<AdminOrdersResponse>(`/api/admin/orders?status=${status}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': password,
      },
    })
  },

  adminApprove(orderId: string, action: 'approve' | 'reject', password: string, notes?: string): Promise<{ success: boolean; evaluationId?: string }> {
    return request<{ success: boolean; evaluationId?: string }>('/api/admin/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': password,
      },
      body: JSON.stringify({ orderId, action, notes }),
    })
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): add submitPayment, getPaymentStatus, admin API methods"
```

---

### Task 9: Rewrite Paywall Component

**Files:**
- Modify: `src/components/Paywall.tsx`

**Interfaces:**
- Consumes: `api.submitPayment`, `api.getPaymentStatus` from Task 8, types from Task 7
- Produces: New paywall UI with QR code + txn ref + polling

- [ ] **Step 1: Rewrite Paywall.tsx**

Replace the contents of `src/components/Paywall.tsx` with:

```typescript
import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

function getDeviceId(): string {
  let id = localStorage.getItem('kaoyan_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('kaoyan_device_id', id)
  }
  return id
}

interface Props {
  evaluationId: string
  lockedCount: number
  onUnlocked: (result: any) => void
}

type PaymentStep = 'idle' | 'submitted' | 'auto_unlocked' | 'pending_review'

export default function Paywall({ evaluationId, lockedCount, onUnlocked }: Props) {
  const [txnRef, setTxnRef] = useState('')
  const [step, setStep] = useState<PaymentStep>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function handleSubmitPayment() {
    if (!txnRef.trim() || txnRef.trim().length < 4) {
      setError('请输入转账单号后4位')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const deviceId = getDeviceId()
      const result = await api.submitPayment(evaluationId, txnRef.trim(), deviceId)
      if (result.autoApproved) {
        setStep('auto_unlocked')
        setMessage(result.message)
        // Fetch full result and unlock
        const fullResult = await api.getResult(evaluationId)
        if (fullResult.data) {
          onUnlocked(fullResult.data)
        }
      } else {
        setStep('pending_review')
        setMessage(result.message)
        // Start polling for approval
        startPolling()
      }
    } catch (err: any) {
      setError(err.message || '提交失败')
    } finally {
      setIsLoading(false)
    }
  }

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.getPaymentStatus(evaluationId)
        if (status.paid) {
          clearInterval(pollRef.current)
          const fullResult = await api.getResult(evaluationId)
          if (fullResult.data) {
            onUnlocked(fullResult.data)
          }
        }
      } catch {
        // keep polling
      }
    }, 5000)
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-paper/60 to-paper flex items-end justify-center pb-8 z-10">
        <div className="text-center max-w-sm">
          <div className="flex items-center justify-center gap-1 mb-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-vermilion" />
            ))}
          </div>
          <p className="text-ink font-medium text-lg mb-2">
            剩余 {lockedCount} 所院校推荐待解锁
          </p>
          <p className="text-graphite text-sm mb-6">
            解锁全部冲/稳/保择校方案仅需 9.9 元
          </p>

          {step === 'idle' && (
            <div className="space-y-4">
              {/* QR Codes */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-graphite mb-3">微信或支付宝扫码付款 9.9 元</p>
                <div className="flex gap-4 justify-center">
                  <div className="text-center">
                    <div className="w-28 h-28 bg-gray-100 rounded-lg mx-auto mb-1 flex items-center justify-center">
                      <img
                        src="/qr-wechat.png"
                        alt="微信收款码"
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                          ;(e.target as HTMLImageElement).parentElement!.innerHTML =
                            '<span class="text-xs text-graphite">微信<br/>收款码</span>'
                        }}
                      />
                    </div>
                    <span className="text-xs text-graphite">微信</span>
                  </div>
                  <div className="text-center">
                    <div className="w-28 h-28 bg-gray-100 rounded-lg mx-auto mb-1 flex items-center justify-center">
                      <img
                        src="/qr-alipay.png"
                        alt="支付宝收款码"
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                          ;(e.target as HTMLImageElement).parentElement!.innerHTML =
                            '<span class="text-xs text-graphite">支付宝<br/>收款码</span>'
                        }}
                      />
                    </div>
                    <span className="text-xs text-graphite">支付宝</span>
                  </div>
                </div>
              </div>

              {/* Txn ref input */}
              <div>
                <label className="block text-xs text-graphite mb-1.5">
                  付款完成后，请输入转账单号<b>后4位</b>
                </label>
                <div className="flex gap-2 justify-center">
                  <input
                    type="text"
                    className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-center font-mono
                               tracking-widest bg-gray-50 focus:border-indigo focus:ring-1 focus:ring-indigo"
                    placeholder="后4位"
                    value={txnRef}
                    onChange={e => setTxnRef(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    maxLength={8}
                    autoFocus
                  />
                  <button
                    onClick={handleSubmitPayment}
                    disabled={isLoading || txnRef.length < 4}
                    className="px-5 py-2 bg-vermilion text-white font-medium rounded-lg
                               hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {isLoading ? '验证中...' : '验证支付'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'auto_unlocked' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">✅ {message}</p>
            </div>
          )}

          {step === 'pending_review' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-medium text-sm">⏳ {message}</p>
              <p className="text-yellow-700 text-xs mt-1">页面将自动检测审核状态，无需刷新</p>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-vermilion">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Paywall.tsx
git commit -m "feat(paywall): rewrite with QR codes, txn ref input, auto-unlock polling"
```

---

### Task 10: Update PreviewPage for Free Period

**Files:**
- Modify: `src/pages/PreviewPage.tsx`

**Interfaces:**
- Consumes: Updated `api.getResult` response from Task 4 (now includes `isFree`, `freeUntil`)

- [ ] **Step 1: Update PreviewPage to handle free period**

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { PreviewResult, EvaluationResult } from '../types'
import SchoolCard from '../components/SchoolCard'
import Paywall from '../components/Paywall'
import LoadingSpinner from '../components/LoadingSpinner'

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFree, setIsFree] = useState(false)

  useEffect(() => {
    if (!id) return
    const cacheKey = `preview-${id}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      try {
        const data = JSON.parse(cached)
        setPreview(data)
        setLoading(false)
        return
      } catch { /* stale cache, continue fetching */ }
    }
    api.getResult(id)
      .then(res => {
        if (res.status === 'processing') {
          navigate(`/evaluating/${id}`, { replace: true })
          return
        }
        if (res.isPaid) {
          navigate(`/result/${id}`, { replace: true })
          return
        }
        // Free period still active → redirect to full result
        if (res.isFree) {
          navigate(`/result/${id}`, { replace: true })
          return
        }
        const data = res.data as PreviewResult
        sessionStorage.setItem(cacheKey, JSON.stringify(data))
        setPreview(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, navigate])

  // Handle unlock from Paywall → navigate to full result
  function handleUnlocked(_result: any) {
    navigate(`/result/${id}`, { replace: true })
  }

  if (loading) return <LoadingSpinner message="加载结果中..." />
  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-vermilion">{error}</p>
      </div>
    )
  }
  if (!preview) return null

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Summary */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-ink font-bold mb-3">你的择校分析报告</h1>
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="text-center">
              <span className="block font-mono text-2xl text-ink font-bold">{preview.summary.total_schools}</span>
              <span className="text-graphite">所推荐院校</span>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <span className="block font-mono text-2xl text-vermilion font-bold">{preview.summary.tier_counts['冲刺']}</span>
              <span className="text-graphite">冲刺</span>
            </div>
            <div className="text-center">
              <span className="block font-mono text-2xl text-indigo font-bold">{preview.summary.tier_counts['稳妥']}</span>
              <span className="text-graphite">稳妥</span>
            </div>
            <div className="text-center">
              <span className="block font-mono text-2xl text-green-600 font-bold">{preview.summary.tier_counts['保底']}</span>
              <span className="text-graphite">保底</span>
            </div>
          </div>
        </div>

        {/* Free preview school */}
        <div className="mb-4">
          <p className="text-sm text-graphite mb-3">
            🎁 免费预览（1/{preview.summary.total_schools} 所院校）
          </p>
          <SchoolCard school={preview.preview_school} index={0} />
        </div>

        {/* Locked schools placeholder + paywall overlay */}
        <div className="relative">
          <div className="opacity-60 blur-[2px] select-none pointer-events-none">
            {[...Array(preview.locked_count)].map((_, i) => (
              <div key={i} className="mb-4">
                <SchoolCard
                  school={preview.preview_school}
                  isLocked
                />
              </div>
            ))}
            <div className="h-32 bg-gradient-to-b from-transparent to-paper" />
          </div>

          <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
            <Paywall
              evaluationId={id!}
              lockedCount={preview.locked_count}
              onUnlocked={handleUnlocked}
            />
          </div>
        </div>

        <p className="text-xs text-graphite/60 text-center mt-8">
          AI 生成，仅供参考。具体招生信息请以各校研究生院官网发布为准。
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PreviewPage.tsx
git commit -m "feat(preview): redirect to full result if within free period"
```

---

### Task 11: Update ResultPage for Free Access

**Files:**
- Modify: `src/pages/ResultPage.tsx`

**Interfaces:**
- Consumes: Updated `api.getResult` — `isPaid` no longer the only gate; `isFree` also grants access

- [ ] **Step 1: Update ResultPage access check**

Replace the access check in `ResultPage.tsx`. The `useEffect` fetch logic changes from:

```typescript
api.getResult(id)
  .then(res => {
    if (!res.isPaid) {
      navigate(`/result/${id}/preview`, { replace: true })
      return
    }
    setResult(res.data as EvaluationResult)
  })
```

To:

```typescript
api.getResult(id)
  .then(res => {
    // Allow access if paid OR within free period
    if (!res.isPaid && !res.isFree) {
      navigate(`/result/${id}/preview`, { replace: true })
      return
    }
    setResult(res.data as EvaluationResult)
  })
```

Make this single edit in `src/pages/ResultPage.tsx` at line 24.

```typescript
// Line 24: change
if (!res.isPaid) {
// to:
if (!res.isPaid && !res.isFree) {
```

- [ ] **Step 2: Same change for ComparePage**

In `src/pages/ComparePage.tsx` at line 29, make the same change:

```typescript
// Line 29: change
if (!res.isPaid) {
// to:
if (!res.isPaid && !res.isFree) {
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/ResultPage.tsx src/pages/ComparePage.tsx
git commit -m "feat(pages): allow free-period access to ResultPage and ComparePage"
```

---

### Task 12: Create Admin Page

**Files:**
- Create: `src/pages/AdminPage.tsx`

**Interfaces:**
- Consumes: `api.getAdminOrders`, `api.adminApprove` from Task 8, types from Task 7

- [ ] **Step 1: Create AdminPage.tsx**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import type { AdminOrder } from '../types'

function getAdminPassword(): string | null {
  return sessionStorage.getItem('kaoyan_admin_pw')
}

function setAdminPassword(pw: string) {
  sessionStorage.setItem('kaoyan_admin_pw', pw)
}

export default function AdminPage() {
  const [password, setPassword] = useState(getAdminPassword() || '')
  const [isAuthed, setIsAuthed] = useState(!!getAdminPassword())
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [statusFilter, setStatusFilter] = useState('created')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchOrders = useCallback(async () => {
    const pw = getAdminPassword()
    if (!pw) return
    setLoading(true)
    setError('')
    try {
      const result = await api.getAdminOrders(statusFilter, pw)
      setOrders(result.orders || [])
    } catch (err: any) {
      setError(err.message || '加载失败')
      if (err.message?.includes('密码')) {
        setIsAuthed(false)
        sessionStorage.removeItem('kaoyan_admin_pw')
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (isAuthed) fetchOrders()
  }, [isAuthed, fetchOrders])

  function handleLogin() {
    if (!password.trim()) return
    setAdminPassword(password.trim())
    setIsAuthed(true)
  }

  async function handleApprove(orderId: string) {
    const pw = getAdminPassword()
    if (!pw) return
    setError('')
    try {
      await api.adminApprove(orderId, 'approve', pw)
      fetchOrders()
    } catch (err: any) {
      setError(err.message || '操作失败')
    }
  }

  async function handleReject(orderId: string) {
    const pw = getAdminPassword()
    if (!pw) return
    setError('')
    try {
      await api.adminApprove(orderId, 'reject', pw)
      fetchOrders()
    } catch (err: any) {
      setError(err.message || '操作失败')
    }
  }

  // Login screen
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <h1 className="font-display text-2xl text-ink font-bold mb-4">管理后台</h1>
          <input
            type="password"
            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-center mb-4
                       focus:border-indigo focus:ring-1 focus:ring-indigo"
            placeholder="请输入管理员密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
          <button
            onClick={handleLogin}
            disabled={!password.trim()}
            className="w-full py-3 bg-indigo text-white font-medium rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            进入
          </button>
        </div>
      </div>
    )
  }

  // Dashboard
  const statusTabs = [
    { key: 'created', label: '待审核' },
    { key: 'paid', label: '已通过' },
    { key: 'cancelled', label: '已拒绝' },
  ]

  const counts: Record<string, number> = {}
  statusTabs.forEach(t => { counts[t.key] = orders.filter(o => o.status === t.key).length })

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl text-ink font-bold">订单管理</h1>
          <button
            onClick={() => { fetchOrders() }}
            className="text-sm text-indigo hover:underline"
          >
            刷新
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-6">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-indigo text-white'
                  : 'bg-white text-graphite border border-gray-200 hover:border-gray-300'
              }`}
            >
              {tab.label} ({counts[tab.key] || 0})
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 text-sm text-vermilion">{error}</p>
        )}

        {loading ? (
          <p className="text-graphite text-sm">加载中...</p>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-graphite">暂无订单</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-gray-100 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 text-sm">
                    <p className="font-mono text-xs text-graphite">订单 #{order.id.slice(0, 8)}</p>
                    <p className="text-graphite">
                      评估ID: <span className="font-mono text-xs">{order.evaluation_id?.slice(0, 8)}</span>
                    </p>
                    <p className="text-graphite">
                      时间: {new Date(order.created_at).toLocaleString('zh-CN')}
                    </p>
                    <p className="text-ink font-medium">
                      转账单号后4位: <span className="font-mono text-lg">{order.txn_ref || '—'}</span>
                    </p>
                    {order.paid_at && (
                      <p className="text-green-600 text-xs">
                        付费时间: {new Date(order.paid_at).toLocaleString('zh-CN')}
                      </p>
                    )}
                  </div>

                  {order.status === 'created' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(order.id)}
                        className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg
                                   hover:bg-green-600 transition-colors"
                      >
                        ✓ 通过
                      </button>
                      <button
                        onClick={() => handleReject(order.id)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg
                                   hover:bg-red-200 transition-colors"
                      >
                        ✗ 拒绝
                      </button>
                    </div>
                  )}

                  {order.status === 'paid' && (
                    <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium">
                      已通过
                    </span>
                  )}

                  {order.status === 'cancelled' && (
                    <span className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full font-medium">
                      已拒绝
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/AdminPage.tsx
git commit -m "feat(admin): create password-protected order review dashboard"
```

---

### Task 13: Update App Routes and Remove RedeemPage

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/pages/RedeemPage.tsx`

- [ ] **Step 1: Update App.tsx routes**

Replace the contents of `src/App.tsx` with:

```typescript
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EvaluatingPage from './pages/EvaluatingPage'
import PreviewPage from './pages/PreviewPage'
import ResultPage from './pages/ResultPage'
import ComparePage from './pages/ComparePage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/evaluating/:id" element={<EvaluatingPage />} />
        <Route path="/result/:id/preview" element={<PreviewPage />} />
        <Route path="/result/:id" element={<ResultPage />} />
        <Route path="/compare/:id" element={<ComparePage />} />
        <Route path="/admin" element={<AdminPage />} />
    </Routes>
  )
}
```

- [ ] **Step 2: Delete RedeemPage**

```bash
rm src/pages/RedeemPage.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git rm src/pages/RedeemPage.tsx
git commit -m "feat(routes): add /admin route, remove /redeem route and RedeemPage"
```

---

### Task 14: Add QR Code Placeholder Images

**Files:**
- Create: `public/qr-alipay.png`
- Create: `public/qr-wechat.png`

**Note:** These are placeholder files. Replace them with your actual payment QR code images before deploying.

- [ ] **Step 1: Create placeholder files**

```bash
# Create tiny placeholder PNG files (1x1 pixel transparent PNGs)
# These will be replaced with actual QR code images
cd public
# Windows: create empty placeholder files
echo. > qr-alipay.png
echo. > qr-wechat.png
```

- [ ] **Step 2: Add setup instructions to README**

In the project README, add a section after "环境变量":

```markdown
### 收款码配置

将你的微信和支付宝个人收款码保存为 PNG 图片，放入 `public/` 目录：

- `public/qr-wechat.png` — 微信收款码
- `public/qr-alipay.png` — 支付宝收款码

> 获取方式：微信/支付宝 → 收付款 → 二维码收款 → 保存图片
```

- [ ] **Step 3: Commit**

```bash
git add public/qr-alipay.png public/qr-wechat.png README.md
git commit -m "feat(assets): add QR code placeholders and setup instructions"
```

---

### Task 15: Deploy and Verify

- [ ] **Step 1: Build frontend**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Deploy worker**

```bash
cd worker && npx wrangler deploy
```

Expected: Worker deploys successfully.

- [ ] **Step 3: Deploy frontend to Cloudflare Pages**

```bash
npx wrangler pages deploy dist --project-name kaoyan-recommender
```

Expected: Pages deploys successfully.

- [ ] **Step 4: Run database migration on production D1**

```bash
cd worker && npx wrangler d1 execute kaoyan-db --file=./schema.sql
```

- [ ] **Step 5: Set ADMIN_PASSWORD secret on production**

```bash
cd worker && npx wrangler secret put ADMIN_PASSWORD
```

- [ ] **Step 6: End-to-end smoke test**

1. Open the deployed site
2. Fill out the evaluation form → should see full result (free period)
3. Wait 24h (or manually set free_until to past in D1 for testing) → should see preview + paywall
4. Click paywall → QR codes should display
5. Input txn ref → should submit
6. Go to `/admin` → enter password → should see pending order → approve
7. User page should auto-unlock (polling)

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final deployment fixes and verification"
```

---

## Self-Review

**1. Spec coverage:**
- [x] Database migration (new columns) → Task 1
- [x] Modified GET /api/result/:id (free period gating) → Task 4
- [x] Modified POST /api/order → replaced by POST /api/submit-payment → Task 4
- [x] Removed POST /api/redeem → Task 4 (route not registered), Task 13 (frontend)
- [x] New POST /api/submit-payment → Task 4
- [x] New GET /api/admin/orders → Task 4
- [x] New POST /api/admin/approve → Task 4
- [x] Paywall.tsx rewrite → Task 9
- [x] PreviewPage.tsx free-period handling → Task 10
- [x] AdminPage.tsx → Task 12
- [x] RedeemPage.tsx deletion → Task 13
- [x] QR code images → Task 14
- [x] First-pay auto-unlock (device_id check) → Task 3, Task 9
- [x] Non-first-pay manual review → Task 3, Task 9 (polling), Task 12 (admin)

**2. Placeholder scan:** No TBD, TODO, or vague instructions found.

**3. Type consistency:**
- Worker `PaymentSubmission` type (Task 2) matches `handleSubmitPayment` usage (Task 4) and frontend `api.submitPayment` params (Task 8) ✓
- `AdminOrdersQuery` / `AdminApproveRequest` (Task 2) match admin route handlers (Task 4) ✓
- Frontend `SubmitPaymentResponse` / `PaymentStatusResponse` / `AdminOrdersResponse` (Task 7) match API client methods (Task 8) and component usage (Tasks 9, 12) ✓
- `getDeviceId()` in Paywall (Task 9) sends `deviceId` param consumed by `submitPayment()` (Task 3) ✓
