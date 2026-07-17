import { useNavigate } from 'react-router-dom'
import EvaluationForm from '../components/EvaluationForm'
import type { EvaluationInput } from '../types'
import { api } from '../lib/api'
import { useState } from 'react'

export default function HomePage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(input: EvaluationInput) {
    setIsLoading(true)
    setError('')
    try {
      const result = await api.evaluate(input)
      // API may return 'completed' (sync LLM) or 'processing' (async/polling)
      if (result.status === 'completed') {
        navigate(`/result/${result.evaluationId}`, { replace: true })
      } else {
        navigate(`/evaluating/${result.evaluationId}`)
      }
    } catch (err: any) {
      setError(err.message || '提交失败，请稍后重试')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      <section className="pt-16 pb-10 px-4 text-center">
        <h1 className="font-display text-4xl sm:text-5xl text-ink font-bold mb-3 tracking-tight">
          考研择校推荐
        </h1>
        <p className="text-graphite text-lg sm:text-xl max-w-md mx-auto">
          AI 个性化择校分析，获取冲/稳/保三梯度推荐方案
        </p>
      </section>

      {/* Form card */}
      <section className="px-4 pb-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <EvaluationForm onSubmit={handleSubmit} isLoading={isLoading} />
          {error && (
            <p className="mt-4 text-sm text-vermilion text-center">{error}</p>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { step: '①', title: '填写背景', desc: '本科院校、专业、目标方向' },
              { step: '②', title: 'AI 分析', desc: '综合评估匹配度与录取概率' },
              { step: '③', title: '获取推荐', desc: '解锁冲·稳·保三梯度方案' },
            ].map((item) => (
              <div key={item.step} className="space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-paper border border-gray-200 flex items-center justify-center font-display text-ink text-sm">
                  {item.step}
                </div>
                <h3 className="font-medium text-ink text-sm">{item.title}</h3>
                <p className="text-graphite text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer disclaimer */}
      <footer className="text-center pb-8">
        <p className="text-xs text-graphite/60">
          所有推荐由 AI 生成，仅供参考。具体招生信息请以各校研究生院官网发布为准。
        </p>
      </footer>
    </div>
  )
}
