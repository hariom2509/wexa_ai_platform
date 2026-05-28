"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useState, useEffect } from 'react'

export default function PublicDashboard({ params }: { params: { token: string } }) {
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchPublicDashboard = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api'}/dashboards/public/${params.token}`)
        if (!res.ok) throw new Error('Public dashboard not found or access denied')
        const data = await res.json()
        setDashboard(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPublicDashboard()
  }, [params.token])

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500">Loading public dashboard...</div>
  if (error) return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-red-500">{error}</div>

  // Mock some chart data just for display purposes since widgets are currently empty in our platform
  const chartData = [
    { name: 'Mon', value: 400 },
    { name: 'Tue', value: 300 },
    { name: 'Wed', value: 550 },
    { name: 'Thu', value: 450 },
    { name: 'Fri', value: 600 },
    { name: 'Sat', value: 800 },
    { name: 'Sun', value: 700 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{dashboard?.name || 'Public Dashboard'}</h1>
            <p className="mt-2 text-sm text-gray-500">Read-only view</p>
          </div>
        </div>
        
        {/* Chart View */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Event Volume</h2>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={true} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
