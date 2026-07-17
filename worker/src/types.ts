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
  created_at: string
  paid_at: string | null
}

export interface RedeemCodeRecord {
  id: string
  code: string
  order_id: string
  used_at: string | null
  created_at: string
}
