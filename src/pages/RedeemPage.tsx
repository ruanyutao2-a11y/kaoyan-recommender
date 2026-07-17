import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function RedeemPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleRedeem() {
    if (!code.trim()) return
    setIsLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await api.redeem(code.trim())
      if (result.success) {
        setSuccess('兑换成功！正在跳转到完整报告...')
        setTimeout(() => {
          navigate(`/result/${result.evaluationId}`, { replace: true })
        }, 1500)
      }
    } catch (err: any) {
      setError(err.message || '兑换失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <h1 className="font-display text-2xl text-ink font-bold mb-2">兑换报告</h1>
          <p className="text-graphite text-sm mb-6">输入你的 12 位兑换码，解锁完整择校方案</p>

          <input
            type="text"
            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-center font-mono text-lg uppercase
                       tracking-widest focus:border-indigo focus:ring-1 focus:ring-indigo mb-4"
            placeholder="XXXX-XXXX-XXXX"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={12}
            autoFocus
          />

          <button
            onClick={handleRedeem}
            disabled={isLoading || code.length < 8}
            className="w-full py-3 bg-vermilion text-white font-medium rounded-lg
                       hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '兑换中...' : '兑换'}
          </button>

          {error && <p className="mt-4 text-sm text-vermilion">{error}</p>}
          {success && <p className="mt-4 text-sm text-green-600">{success}</p>}

          <a href="/" className="block mt-6 text-sm text-indigo hover:underline">
            ← 返回首页重新评估
          </a>
        </div>
      </div>
    </div>
  )
}
