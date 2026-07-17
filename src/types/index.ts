export interface EvaluationInput {
  school: string
  major: string
  gpa?: string
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
  data: PreviewResult | EvaluationResult
}

export interface OrderResponse {
  orderId: string
  taobaoUrl: string
  redeemCode: string
  message: string
}

export interface RedeemResponse {
  success: boolean
  message: string
  evaluationId?: string
  data?: EvaluationResult
}
