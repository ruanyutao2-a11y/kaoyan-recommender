import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'

export default function EvaluatingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const pollRef = useRef<ReturnType<typeof setInterval>>()
  const [message, setMessage] = useState('正在分析你的背景信息...')

  useEffect(() => {
    if (!id) return

    const messages = [
      '正在分析你的背景信息...',
      '正在匹配院校数据库...',
      '正在计算各院校匹配度...',
      '正在生成个性化推荐方案...',
    ]
    let msgIndex = 0
    const msgTimer = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length
      setMessage(messages[msgIndex])
    }, 3000)

    pollRef.current = setInterval(async () => {
      try {
        const result = await api.getResult(id)
        if (result.status === 'completed') {
          clearInterval(pollRef.current)
          clearInterval(msgTimer)
          navigate(`/result/${id}/preview`, { replace: true })
        } else if (result.status === 'failed') {
          clearInterval(pollRef.current)
          clearInterval(msgTimer)
          navigate('/', { replace: true })
        }
      } catch {
        // Keep polling on error
      }
    }, 2000)

    return () => {
      clearInterval(pollRef.current)
      clearInterval(msgTimer)
    }
  }, [id, navigate])

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="text-center">
        <LoadingSpinner message={message} />
        <p className="text-graphite/50 text-xs mt-8">评估通常在 10-15 秒内完成</p>
      </div>
    </div>
  )
}
