import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { PreviewResult } from '../types'
import SchoolCard from '../components/SchoolCard'
import Paywall from '../components/Paywall'
import LoadingSpinner from '../components/LoadingSpinner'

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
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
        setPreview(res.data as PreviewResult)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, navigate])

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
            🎁 免费预览（1/{preview.summary.total_schools}）
          </p>
          <SchoolCard school={preview.preview_school} index={0} />
        </div>

        {/* Locked schools placeholder + paywall */}
        <div className="relative">
          {[...Array(preview.locked_count)].map((_, i) => (
            <div key={i} className="mb-4">
              <SchoolCard
                school={preview.preview_school}
                isLocked
              />
            </div>
          ))}

          <Paywall
            evaluationId={id!}
            lockedCount={preview.locked_count}
            onUnlocked={() => navigate(`/result/${id}`, { replace: true })}
          />
        </div>

        <p className="text-xs text-graphite/60 text-center mt-8">
          AI 生成，仅供参考。具体招生信息请以各校研究生院官网发布为准。
        </p>
      </div>
    </div>
  )
}
