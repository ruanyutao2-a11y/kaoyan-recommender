import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import type { AdminOrder } from '../types'

function getAdminPassword(): string | null {
  return sessionStorage.getItem('kaoyan_admin_pw')
}

function setAdminPassword(pw: string) {
  sessionStorage.setItem('kaoyan_admin_pw', pw)
}

export default function AdminPage() {
  const [password, setPassword] = useState(getAdminPassword() || '')
  const [isAuthed, setIsAuthed] = useState(!!getAdminPassword())
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [statusFilter, setStatusFilter] = useState('created')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchOrders = useCallback(async () => {
    const pw = getAdminPassword()
    if (!pw) return
    setLoading(true)
    setError('')
    try {
      const result = await api.getAdminOrders(statusFilter, pw)
      setOrders(result.orders || [])
    } catch (err: any) {
      setError(err.message || '加载失败')
      if (err.message?.includes('密码')) {
        setIsAuthed(false)
        sessionStorage.removeItem('kaoyan_admin_pw')
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (isAuthed) fetchOrders()
  }, [isAuthed, fetchOrders])

  function handleLogin() {
    if (!password.trim()) return
    setAdminPassword(password.trim())
    setIsAuthed(true)
  }

  async function handleApprove(orderId: string) {
    const pw = getAdminPassword()
    if (!pw) return
    setError('')
    try {
      await api.adminApprove(orderId, 'approve', pw)
      fetchOrders()
    } catch (err: any) {
      setError(err.message || '操作失败')
    }
  }

  async function handleReject(orderId: string) {
    const pw = getAdminPassword()
    if (!pw) return
    setError('')
    try {
      await api.adminApprove(orderId, 'reject', pw)
      fetchOrders()
    } catch (err: any) {
      setError(err.message || '操作失败')
    }
  }

  // Login screen
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <h1 className="font-display text-2xl text-ink font-bold mb-4">管理后台</h1>
          <input
            type="password"
            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-center mb-4
                       focus:border-indigo focus:ring-1 focus:ring-indigo"
            placeholder="请输入管理员密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
          <button
            onClick={handleLogin}
            disabled={!password.trim()}
            className="w-full py-3 bg-indigo text-white font-medium rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            进入
          </button>
        </div>
      </div>
    )
  }

  // Dashboard
  const statusTabs = [
    { key: 'created', label: '待审核' },
    { key: 'paid', label: '已通过' },
    { key: 'cancelled', label: '已拒绝' },
  ]

  const counts: Record<string, number> = {}
  statusTabs.forEach(t => { counts[t.key] = orders.filter(o => o.status === t.key).length })

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl text-ink font-bold">订单管理</h1>
          <button
            onClick={() => { fetchOrders() }}
            className="text-sm text-indigo hover:underline"
          >
            刷新
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-6">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-indigo text-white'
                  : 'bg-white text-graphite border border-gray-200 hover:border-gray-300'
              }`}
            >
              {tab.label} ({counts[tab.key] || 0})
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 text-sm text-vermilion">{error}</p>
        )}

        {loading ? (
          <p className="text-graphite text-sm">加载中...</p>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <p className="text-graphite">暂无订单</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-gray-100 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 text-sm">
                    <p className="font-mono text-xs text-graphite">订单 #{order.id.slice(0, 8)}</p>
                    <p className="text-graphite">
                      评估ID: <span className="font-mono text-xs">{order.evaluation_id?.slice(0, 8)}</span>
                    </p>
                    <p className="text-graphite">
                      时间: {new Date(order.created_at).toLocaleString('zh-CN')}
                    </p>
                    <p className="text-ink font-medium">
                      转账单号后4位: <span className="font-mono text-lg">{order.txn_ref || '—'}</span>
                    </p>
                    {order.paid_at && (
                      <p className="text-green-600 text-xs">
                        付费时间: {new Date(order.paid_at).toLocaleString('zh-CN')}
                      </p>
                    )}
                  </div>

                  {order.status === 'created' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(order.id)}
                        className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg
                                   hover:bg-green-600 transition-colors"
                      >
                        ✓ 通过
                      </button>
                      <button
                        onClick={() => handleReject(order.id)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg
                                   hover:bg-red-200 transition-colors"
                      >
                        ✗ 拒绝
                      </button>
                    </div>
                  )}

                  {order.status === 'paid' && (
                    <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium">
                      已通过
                    </span>
                  )}

                  {order.status === 'cancelled' && (
                    <span className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full font-medium">
                      已拒绝
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
