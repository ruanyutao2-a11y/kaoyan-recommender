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
