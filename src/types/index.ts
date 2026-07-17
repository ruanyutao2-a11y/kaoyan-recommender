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
