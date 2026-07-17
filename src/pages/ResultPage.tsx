import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { exportPDF } from '../lib/pdf'
import type { EvaluationResult } from '../types'
import SchoolCard from '../components/SchoolCard'
import CompareBarChart from '../components/CompareBarChart'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ResultPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [isPaid, setIsPaid] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    api.getResult(id)
      .then(res => {
        if (!res.isPaid && !res.isFree) {
          navigate(`/result/${id}/preview`, { replace: true })
          return
        }
        setResult(res.data as EvaluationResult)
          setIsPaid(res.isPaid)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current || !result) return
    setPdfLoading(true)
    setPdfError('')
    try {
      const schoolName = result.recommendations[0]?.name || '报告'
      const date = new Date().toISOString().slice(0, 10)
      await exportPDF(reportRef.current, `考研择校报告_${schoolName}_${date}.pdf`)
    } catch (err: any) {
      setPdfError(err.message || 'PDF 生成失败，请重试')
    } finally {
      setPdfLoading(false)
    }
  }, [result])

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
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .school-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Report content — targeted by PDF export */}
        <div ref={reportRef} id="report-content">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl text-ink font-bold mb-2">完整择校报告</h1>
            <p className="text-graphite">{result.summary.overall_assessment}</p>
          </div>

          {/* Export PDF button — only for paid users */}
          {isPaid && (
          <div className="text-center mb-8 no-print">
            <button
              onClick={handleExportPDF}
              disabled={pdfLoading}
              className="px-6 py-3 bg-indigo text-white font-medium rounded-lg
                         hover:bg-blue-700 active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfLoading ? '⏳ 正在生成 PDF...' : '📄 导出 PDF'}
            </button>
            <p className="text-graphite text-xs mt-2">一键下载完整择校报告</p>
            {pdfError && (
              <p className="text-vermilion text-xs mt-2">{pdfError}</p>
            )}
          </div>
          )}

          {/* 上岸难度对比 — 内嵌条形图 */}
          <div className="mb-8 p-4 sm:p-6 bg-white rounded-xl border border-gray-100">
            <h2 className="font-display text-lg text-ink font-semibold mb-4">
              📊 上岸难度对比
            </h2>
            <CompareBarChart schools={result.recommendations} sortBy="match_score" compact />
            <div className="mt-4 pt-3 border-t border-gray-100 text-right no-print">
              <Link
                to={`/compare/${id}`}
                className="text-sm text-indigo hover:text-indigo/80 font-medium"
              >
                查看详细对比 →
              </Link>
            </div>
          </div>

          {/* Schools by tier */}
          {tiers.map(tier => {
            const schools = result.recommendations.filter(s => s.tier === tier)
            if (schools.length === 0) return null

            const tierLabel = {
              '冲刺': '🔥 冲刺院校',
              '稳妥': '⭐ 稳妥院校',
              '保底': '✅ 保底院校',
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
    </div>
  )
}
