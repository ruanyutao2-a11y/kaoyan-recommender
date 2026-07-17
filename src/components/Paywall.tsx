import { useState } from 'react'
import type { OrderResponse } from '../types'
import { api } from '../lib/api'

interface Props {
  evaluationId: string
  lockedCount: number
  onUnlocked: (result: any) => void
}

export default function Paywall({ evaluationId, lockedCount, onUnlocked }: Props) {
  const [redeemCode, setRedeemCode] = useState('')
  const [orderInfo, setOrderInfo] = useState<OrderResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRedeem() {
    if (!redeemCode.trim()) return
    setIsLoading(true)
    setError('')
    try {
      const result = await api.redeem(redeemCode.trim())
      if (result.success && result.data) {
        onUnlocked(result.data)
      }
    } catch (err: any) {
      setError(err.message || '兑换失败')
    } finally {
      setIsLoading(false)
    }
  }

  // Click "unlock" → go directly to Taobao first, then reveal redeem input
  async function handleUnlock() {
    setIsLoading(true)
    setError('')
    try {
      const result = await api.createOrder(evaluationId)
      setOrderInfo(result)
    } catch (err: any) {
      setError(err.message || '创建订单失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Gradient overlay over locked cards */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-paper/60 to-paper flex items-end justify-center pb-8 z-10">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-vermilion" />
            ))}
          </div>
          <p className="text-ink font-medium text-lg mb-2">
            还有 {lockedCount} 所院校推荐待解锁
          </p>
          <p className="text-graphite text-sm mb-6">
            仅需 9.9 元，获取完整的冲/稳/保择校方案
          </p>

          {!orderInfo ? (
            <button
              onClick={handleUnlock}
              disabled={isLoading}
              className="px-8 py-3 bg-vermilion text-white font-medium rounded-lg
                         hover:bg-red-700 active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {isLoading ? '处理中...' : '🔓 9.9 元解锁完整结果'}
            </button>
          ) : (
            <div className="space-y-4">
              {/* Taobao button */}
              <a
                href={orderInfo.taobaoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-8 py-3 bg-orange-500 text-white font-medium rounded-lg
                           hover:bg-orange-600 transition-colors text-lg"
              >
                前往淘宝付款 →
              </a>

              <p className="text-graphite text-xs">
                付款完成后，联系客服获取兑换码，然后在此输入兑换码解锁
              </p>

              {/* Redeem section */}
              <div>
                <div className="flex items-center gap-2 max-w-xs mx-auto">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono uppercase
                               focus:border-indigo focus:ring-1 focus:ring-indigo"
                    placeholder="输入兑换码"
                    value={redeemCode}
                    onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                    maxLength={12}
                  />
                  <button
                    onClick={handleRedeem}
                    disabled={isLoading || redeemCode.length < 8}
                    className="px-4 py-2 bg-indigo text-white text-sm font-medium rounded-lg
                               hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    兑换
                  </button>
                </div>
              </div>
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
