import { useEffect, useState, useRef } from 'react'
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
  const printRef = useRef<HTMLDivElement>(null)

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

  function handleExportPDF() {
    window.print()
  }

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
      {/* Print-only styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .school-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto px-4 py-10" ref={printRef}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-ink font-bold mb-2">完整择校报告</h1>
          <p className="text-graphite">{result.summary.overall_assessment}</p>
        </div>

        {/* Export PDF button */}
        <div className="text-center mb-8 no-print">
          <button
            onClick={handleExportPDF}
            className="px-6 py-3 bg-indigo text-white font-medium rounded-lg
                       hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            📄 导出 PDF / 打印报告
          </button>
          <p className="text-graphite text-xs mt-2">点击后使用浏览器「另存为 PDF」即可</p>
        </div>

        {/* Discrimination & Difficulty comparison */}
        <div className="mb-8 p-4 bg-white rounded-xl border border-gray-100 no-print">
          <h2 className="font-display text-lg text-ink font-semibold mb-3">filter 上岸难度对比</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.recommendations.map(s => (
              <div key={s.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium text-sm text-ink">{s.name}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                    s.discrimination === '低' ? 'bg-green-100 text-green-700' :
                    s.discrimination === '中' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    歧视{s.discrimination}
                  </span>
                </div>
                <span className={`text-xs font-mono font-medium ${
                  s.difficulty === '极难' ? 'text-red-600' :
                  s.difficulty === '较难' ? 'text-orange-600' :
                  s.difficulty === '中等' ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {s.difficulty}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Schools by tier */}
        {tiers.map(tier => {
          const schools = result.recommendations.filter(s => s.tier === tier)
          if (schools.length === 0) return null

          const tierLabel = {
            '冲刺': 'fire 冲刺院校',
            '稳妥': 'star 稳妥院校',
            '保底': 'check-circle 保底院校',
          }[tier]

          return (
            <div key={tier} className="mb-10">
              <h2 className="font-display text-xl text-ink mb-4 font-semibold">{tierLabel}</h2>
              <div className="space-y-4">
                {schools.map((school, i) => (
                  <div key={school.name} className="school-card">
                    <SchoolCard school={school} index={i} />
                  </div>
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
