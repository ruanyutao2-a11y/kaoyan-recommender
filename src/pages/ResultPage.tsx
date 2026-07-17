import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { EvaluationResult } from '../types'
import SchoolCard from '../components/SchoolCard'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ResultPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api.getResult(id)
      .then(res => {
        if (!res.isPaid) {
          navigate(`/result/${id}/preview`, { replace: true })
          return
        }
        setResult(res.data as EvaluationResult)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <LoadingSpinner message="加载完整报告..." />
  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-vermilion">{error}</p>
      </div>
    )
  }
  if (!result) return null

  const tiers = ['冲刺', '稳妥', '保底'] as const

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-ink font-bold mb-2">你的完整择校报告</h1>
          <p className="text-graphite">{result.summary.overall_assessment}</p>
        </div>

        {/* Schools by tier */}
        {tiers.map(tier => {
          const schools = result.recommendations.filter(s => s.tier === tier)
          if (schools.length === 0) return null

          const tierLabel = {
            '冲刺': '🔴 冲刺院校',
            '稳妥': '🔵 稳妥院校',
            '保底': '🟢 保底院校',
          }[tier]

          return (
            <div key={tier} className="mb-10">
              <h2 className="font-display text-xl text-ink mb-4 font-semibold">{tierLabel}</h2>
              <div className="space-y-4">
                {schools.map((school, i) => (
                  <SchoolCard key={school.name} school={school} index={i} />
                ))}
              </div>
            </div>
          )
        })}

        {/* Disclaimer */}
        <div className="mt-10 p-4 bg-white rounded-xl border border-gray-200 text-center">
          <p className="text-xs text-graphite leading-relaxed">
            {result.disclaimer}
          </p>
        </div>
      </div>
    </div>
  )
}
