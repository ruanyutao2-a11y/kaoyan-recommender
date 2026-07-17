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
    // Pass device_id so the server knows if this is first-time or repeat
    const deviceId = localStorage.getItem('kaoyan_device_id') || ''
    return request<EvaluateResponse>('/api/evaluate', {
      method: 'POST',
      body: JSON.stringify({ ...input, deviceId }),
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
