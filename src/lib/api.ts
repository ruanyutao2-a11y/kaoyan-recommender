import type {
  EvaluationInput,
  EvaluateResponse,
  ResultResponse,
  OrderResponse,
  RedeemResponse,
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

  createOrder(evaluationId: string): Promise<OrderResponse> {
    return request<OrderResponse>('/api/order', {
      method: 'POST',
      body: JSON.stringify({ evaluationId }),
    })
  },

  redeem(code: string): Promise<RedeemResponse> {
    return request<RedeemResponse>('/api/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  },
}
