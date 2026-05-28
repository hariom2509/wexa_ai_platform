"use client"

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useWebSocket } from '@/lib/WebSocketProvider'

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

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

  useEffect(() => {
    fetchAlerts()
  }, [])

  const { lastMessage } = useWebSocket()

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'new_alert') {
        setAlerts(prev => [lastMessage.data, ...prev])
      } else if (lastMessage.type === 'resolve_alert') {
        setAlerts(prev => prev.map(a => a.id === lastMessage.data.id ? { ...a, status: 'resolved' } : a))
      }
    }
  }, [lastMessage])

  const handleCreateAlert = async () => {
    setIsCreating(true)
    setError('')
    try {
      await api.post('/alerts/', {
        metric: "cpu",
        threshold: 90
      })
      await fetchAlerts()
    } catch (err: any) {
      // API error handling
      const message = typeof err.message === 'object' ? JSON.stringify(err.message) : err.message
      setError(message || 'Failed to create alert')
    } finally {
      setIsCreating(false)
    }
  }

  const handleResolveAlert = async (alertId: number) => {
    try {
      await api.put(`/alerts/${alertId}/resolve`, {})
      await fetchAlerts()
    } catch (err: any) {
      console.error('Failed to resolve alert', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Alerts</h1>
          <button
            onClick={handleCreateAlert}
            disabled={isCreating}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {isCreating ? 'Triggering...' : 'Simulate Alert'}
          </button>
        </div>

        {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-500">{error}</div>}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full text-center py-8 text-gray-500">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">No active alerts. Everything is normal!</div>
          ) : (
            alerts.map((alert: any) => (
              <div key={alert.id} className={`rounded-xl bg-white p-6 shadow-sm border-l-4 ${alert.status === 'active' ? 'border-red-500' : 'border-gray-300'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Metric: {alert.metric}</h3>
                    <p className="text-sm text-gray-500 mt-1">Threshold: {alert.threshold}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    alert.status === 'active' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {alert.status}
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">ID: <span className="font-medium text-gray-900">#{alert.id}</span></span>
                    {alert.status === 'active' && (
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        Resolve Alert
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
