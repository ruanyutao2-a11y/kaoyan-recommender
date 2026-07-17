import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { EvaluationResult } from '../types'
import type { SortKey } from '../lib/chart'
import { getSortLabel } from '../lib/chart'
import CompareBarChart from '../components/CompareBarChart'
import CompareTable from '../components/CompareTable'
import LoadingSpinner from '../components/LoadingSpinner'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'match_score', label: '匹配度' },
  { key: 'difficulty', label: '上岸难度' },
  { key: 'discrimination', label: '歧视程度' },
]

export default function ComparePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('match_score')

  useEffect(() => {
    if (!id) return
    api.getResult(id)
      .then(res => {
        if (!res.isPaid && !res.isFree) {
          navigate(`/result/${id}/preview`, { replace: true })
          return
        }
        setResult(res.data as EvaluationResult)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <LoadingSpinner message="加载对比数据..." />
  if (error) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4">
        <p className="text-vermilion">{error}</p>
        <Link to={`/result/${id}`} className="text-sm text-indigo hover:underline">
          ← 返回完整报告
        </Link>
      </div>
    )
  }
  if (!result) return null

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <Link
          to={`/result/${id}`}
          className="inline-block text-sm text-indigo hover:text-indigo/80 mb-6"
        >
          ← 返回完整报告
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl text-ink font-bold mb-2">上岸难度对比</h1>
          <p className="text-graphite">
            {result.recommendations.length} 所院校横向对比 · 选择最适合你的目标
          </p>
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-1 mb-6 bg-white rounded-xl p-1 border border-gray-100 w-fit">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sortBy === opt.key
                  ? 'bg-indigo text-white'
                  : 'text-graphite hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Bar chart section */}
        <section className="mb-10 bg-white rounded-xl border border-gray-100 p-4 sm:p-6">
          <h2 className="font-display text-lg text-ink font-semibold mb-4">
            📊 {getSortLabel(sortBy)}排序
          </h2>
          <CompareBarChart schools={result.recommendations} sortBy={sortBy} />
        </section>

        {/* Comparison table section */}
        <section className="bg-white rounded-xl border border-gray-100 p-4 sm:p-6">
          <h2 className="font-display text-lg text-ink font-semibold mb-4">
            📋 多维度对比表
          </h2>
          <CompareTable schools={result.recommendations} sortBy={sortBy} />
        </section>
      </div>
    </div>
  )
}
