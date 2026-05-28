"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useWebSocket } from '@/lib/WebSocketProvider'

export default function Dashboard() {
  const [data, setData] = useState<any[]>([])
  const [metrics, setMetrics] = useState({
    totalEvents: 0,
    activeAlerts: 0,
    aiInsights: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        // We fetch events and calculate metrics for a dynamic view.
        const events = await api.get('/events/')
        const alerts = await api.get('/alerts/')
        
        setMetrics({
          totalEvents: events.length,
          activeAlerts: alerts.filter((a: any) => a.status === 'active').length,
          aiInsights: 0 // Placeholder
        })

        // Build basic chart data from events by date
        const chartData = events.reduce((acc: any, event: any) => {
          const date = new Date(event.created_at).toLocaleDateString()
          const existing = acc.find((d: any) => d.name === date)
          if (existing) {
            existing.events += 1
          } else {
            acc.push({ name: date, events: 1 })
          }
          return acc
        }, [])
        
        setData(chartData.slice(-7)) // Last 7 days/items
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const { lastMessage } = useWebSocket()

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'new_event') {
        setMetrics(prev => ({ ...prev, totalEvents: prev.totalEvents + 1 }))
        // Also update chart data by finding today's date
        setData(prevData => {
          const newData = [...prevData]
          const today = new Date().toLocaleDateString()
          const todayIdx = newData.findIndex(d => d.name === today)
          if (todayIdx >= 0) {
            newData[todayIdx].events += 1
          } else {
            newData.push({ name: today, events: 1 })
            if (newData.length > 7) newData.shift()
          }
          return newData
        })
      } else if (lastMessage.type === 'new_alert') {
        setMetrics(prev => ({ ...prev, activeAlerts: prev.activeAlerts + 1 }))
      } else if (lastMessage.type === 'resolve_alert') {
        setMetrics(prev => ({ ...prev, activeAlerts: Math.max(0, prev.activeAlerts - 1) }))
      }
    }
  }, [lastMessage])

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-4xl font-bold text-gray-900">Analytics Dashboard</h1>
        
        {/* KPI Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Total Events</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.totalEvents}</p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Active Alerts</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.activeAlerts}</p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">AI Insights</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{metrics.aiInsights}</p>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Event Volume</h2>
          <div className="h-96 w-full">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip />
                  <Line type="monotone" dataKey="events" stroke="#2563eb" strokeWidth={3} dot={true} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">No data available. Try creating some events.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}