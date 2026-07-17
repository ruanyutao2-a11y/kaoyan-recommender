import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'

const STEPS = [
  { icon: '📋', label: '分析你的背景信息' },
  { icon: '🔍', label: '联网搜索院校数据' },
  { icon: '📊', label: '计算各院校匹配度' },
  { icon: '🎯', label: '生成个性化推荐方案' },
  { icon: '✅', label: '整理最终择校报告' },
]

export default function EvaluatingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const safetyRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!id) return

    // Advance through animation steps
    const stepTimer = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < STEPS.length - 1) return prev + 1
        return prev
      })
    }, 3000)

    // Poll for result
    pollRef.current = setInterval(async () => {
      try {
        const result = await api.getResult(id)
        if (result.status === 'completed') {
          clearInterval(pollRef.current)
          clearInterval(stepTimer)
          navigate(`/result/${id}/preview`, { replace: true })
        } else if (result.status === 'failed') {
          clearInterval(pollRef.current)
          clearInterval(stepTimer)
          navigate('/', { replace: true })
        }
      } catch {
        // keep polling
      }
    }, 3000)

    // Safety timeout: 120s
    safetyRef.current = setTimeout(() => {
      clearInterval(pollRef.current)
      clearInterval(stepTimer)
      navigate('/', { replace: true })
    }, 120000)

    return () => {
      clearInterval(pollRef.current)
      clearInterval(stepTimer)
      if (safetyRef.current) clearTimeout(safetyRef.current)
    }
  }, [id, navigate])

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Main loading animation */}
        <div className="flex justify-center mb-10">
          <div className="relative w-24 h-24">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-indigo/10" />
            {/* Spinning ring */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo animate-spin" />
            {/* Inner pulse */}
            <div className="absolute inset-3 rounded-full bg-indigo/5 animate-pulse flex items-center justify-center">
              <span className="text-3xl">
                {STEPS[currentStep].icon}
              </span>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="space-y-3 mb-8">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${
                i === currentStep
                  ? 'bg-indigo/5 border border-indigo/20 scale-[1.02]'
                  : i < currentStep
                  ? 'bg-green-50/50 border border-green-100'
                  : 'bg-transparent border border-transparent opacity-40'
              }`}
            >
              <span className={`text-lg transition-all duration-300 ${
                i < currentStep ? 'scale-110' : i === currentStep ? 'animate-bounce' : ''
              }`}>
                {i < currentStep ? '✅' : step.icon}
              </span>
              <span className={`text-sm font-medium transition-colors duration-300 ${
                i < currentStep ? 'text-green-700' : i === currentStep ? 'text-indigo' : 'text-graphite'
              }`}>
                {step.label}
              </span>
              {i === currentStep && (
                <span className="ml-auto flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo to-blue-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <p className="text-center text-graphite/50 text-xs mt-6">
          评估通常在 10-20 秒内完成
        </p>
      </div>
    </div>
  )
}
