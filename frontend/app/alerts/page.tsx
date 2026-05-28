"use client"

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useWebSocket } from '@/lib/WebSocketProvider'

const STATUS_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  active:    { color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400', label: 'Active' },
  triggered: { color: 'bg-red-100 text-red-800',    dot: 'bg-red-500 animate-pulse', label: 'Triggered' },
  resolved:  { color: 'bg-green-100 text-green-800', dot: 'bg-green-400', label: 'Resolved' },
  muted:     { color: 'bg-gray-100 text-gray-500',  dot: 'bg-gray-400', label: 'Muted' },
}

const BORDER_COLOR: Record<string, string> = {
  active: 'border-yellow-400',
  triggered: 'border-red-500',
  resolved: 'border-green-400',
  muted: 'border-gray-300',
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [nameEdited, setNameEdited] = useState(false)

  const [form, setForm] = useState({
    name: '',
    metric: '',
    condition: '>',
    threshold: 10,
    window_minutes: 10,
    notification_channel: 'in-app',
    webhook_url: '',
  })

  // Auto-generate a human-readable alert name from the rule fields
  const autoName = form.metric
    ? `${form.metric} ${form.condition} ${form.threshold} in ${form.window_minutes}m`
    : ''
  const displayName = nameEdited ? form.name : autoName

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const data = await api.get('/alerts/')
      setAlerts(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAlerts() }, [])

  const { lastMessage } = useWebSocket()
  useEffect(() => {
    if (!lastMessage) return
    if (lastMessage.type === 'new_alert') {
      setAlerts(prev => [lastMessage.data, ...prev])
    } else if (lastMessage.type === 'resolve_alert') {
      setAlerts(prev => prev.map(a => a.id === lastMessage.data.id ? { ...a, status: 'resolved' } : a))
    } else if (lastMessage.type === 'alert_triggered') {
      setAlerts(prev => prev.map(a => a.id === lastMessage.data.id ? { ...a, status: 'triggered', triggered_value: lastMessage.data.triggered_value } : a))
    }
  }, [lastMessage])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/alerts/', {
        ...form,
        name: displayName || 'Unnamed Alert',
        threshold: Number(form.threshold),
        window_minutes: Number(form.window_minutes),
        webhook_url: form.webhook_url || undefined,
      })
      setShowCreateForm(false)
      setNameEdited(false)
      setForm({ name: '', metric: '', condition: '>', threshold: 10, window_minutes: 10, notification_channel: 'in-app', webhook_url: '' })
      await fetchAlerts()
    } catch (err: any) {
      setError(err.message || 'Failed to create alert')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolve = async (id: number) => {
    try { await api.put(`/alerts/${id}/resolve`, {}); await fetchAlerts() }
    catch (e) { console.error(e) }
  }

  const handleMute = async (id: number) => {
    try { await api.put(`/alerts/${id}/mute`, { minutes: 30 }); await fetchAlerts() }
    catch (e) { console.error(e) }
  }

  const handleTrigger = async (id: number) => {
    try { await api.put(`/alerts/${id}/trigger`, {}); await fetchAlerts() }
    catch (e) { console.error(e) }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Alerts</h1>
            <p className="text-sm text-gray-500 mt-1">Rules are evaluated every 60 seconds via Celery Beat</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            {showCreateForm ? 'Cancel' : '+ New Alert Rule'}
          </button>
        </div>

        {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-500">{error}</div>}

        {/* Create form */}
        {showCreateForm && (
          <form onSubmit={handleCreate} className="mb-8 bg-white rounded-xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <h2 className="col-span-2 text-lg font-bold text-gray-900">New Alert Rule</h2>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alert Name
                {!nameEdited && autoName && (
                  <span className="ml-2 text-xs text-blue-500 font-normal">auto-generated</span>
                )}
              </label>
              <input
                value={nameEdited ? form.name : autoName}
                onChange={e => { setNameEdited(true); setForm(f => ({...f, name: e.target.value})) }}
                onFocus={() => { if (!nameEdited && autoName) { setNameEdited(true); setForm(f => ({...f, name: autoName})) } }}
                className="w-full border rounded-md px-3 py-2"
                placeholder={autoName || 'Will be auto-generated from rule fields...'}
              />
              {nameEdited && (
                <button type="button" onClick={() => { setNameEdited(false); setForm(f => ({...f, name: ''})) }}
                  className="text-xs text-gray-400 hover:text-gray-600 mt-1">↩ Reset to auto-generated</button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metric (event_type)</label>
              <input required value={form.metric} onChange={e => setForm(f => ({...f, metric: e.target.value}))}
                className="w-full border rounded-md px-3 py-2" placeholder="error" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select value={form.condition} onChange={e => setForm(f => ({...f, condition: e.target.value}))}
                className="w-full border rounded-md px-3 py-2">
                {['>', '<', '>=', '<=', '=='].map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Threshold (count)</label>
              <input type="number" required value={form.threshold} onChange={e => setForm(f => ({...f, threshold: +e.target.value}))}
                className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Window (minutes)</label>
              <input type="number" required value={form.window_minutes} onChange={e => setForm(f => ({...f, window_minutes: +e.target.value}))}
                className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notification Channel</label>
              <select value={form.notification_channel} onChange={e => setForm(f => ({...f, notification_channel: e.target.value}))}
                className="w-full border rounded-md px-3 py-2">
                <option value="in-app">In-App</option>
                <option value="email">Email</option>
                <option value="webhook">Webhook (Slack)</option>
              </select>
            </div>
            {form.notification_channel === 'webhook' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                <input value={form.webhook_url} onChange={e => setForm(f => ({...f, webhook_url: e.target.value}))}
                  className="w-full border rounded-md px-3 py-2" placeholder="https://hooks.slack.com/services/..." />
              </div>
            )}
            <div className="col-span-2 flex justify-end">
              <button type="submit" disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-md disabled:opacity-50">
                {submitting ? 'Creating...' : 'Create Alert Rule'}
              </button>
            </div>
          </form>
        )}

        {/* Alert cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full text-center py-8 text-gray-500">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">No alert rules yet. Create one above!</div>
          ) : (
            alerts.map((alert: any) => {
              const cfg = STATUS_CONFIG[alert.status] || STATUS_CONFIG.active
              const border = BORDER_COLOR[alert.status] || 'border-gray-300'
              return (
                <div key={alert.id} className={`rounded-xl bg-white p-5 shadow-sm border-l-4 ${border}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{alert.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {alert.metric} {alert.condition} {alert.threshold} in {alert.window_minutes}m
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-full ${cfg.color}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  {alert.triggered_value !== null && alert.triggered_value !== undefined && (
                    <p className="text-xs text-red-600 mb-2">
                      Triggered at: <strong>{alert.triggered_value}</strong>
                      {alert.triggered_at && ` · ${new Date(alert.triggered_at).toLocaleString()}`}
                    </p>
                  )}
                  {alert.muted_until && alert.status === 'muted' && (
                    <p className="text-xs text-gray-500 mb-2">
                      Muted until: {new Date(alert.muted_until).toLocaleString()}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 text-xs">
                    <span className="text-gray-400 flex-1">
                      {alert.notification_channel === 'webhook' ? '🔗 Webhook' :
                       alert.notification_channel === 'email' ? '📧 Email' : '🔔 In-app'}
                    </span>
                    {alert.status !== 'resolved' && (
                      <button onClick={() => handleResolve(alert.id)}
                        className="text-green-600 hover:text-green-800 font-medium">Resolve</button>
                    )}
                    {alert.status === 'active' && (
                      <button onClick={() => handleMute(alert.id)}
                        className="text-gray-500 hover:text-gray-700 font-medium">Mute 30m</button>
                    )}
                    {alert.status !== 'resolved' && (
                      <button onClick={() => handleTrigger(alert.id)}
                        className="text-orange-500 hover:text-orange-700 font-medium">Test</button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
