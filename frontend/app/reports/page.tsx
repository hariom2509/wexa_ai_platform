"use client"

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

const SCHEDULE_LABELS: Record<string, string> = {
  daily: '🔁 Daily at 7 AM UTC',
  weekly: '🔁 Weekly (Mon 7 AM UTC)',
  monthly: '🔁 Monthly (1st, 7 AM UTC)',
}

export default function Reports() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [reportName, setReportName] = useState('')
  const [schedule, setSchedule] = useState<string>('')

  const fetchReports = async () => {
    try {
      setLoading(true)
      const data = await api.get('/reports/')
      setReports(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReports() }, [])

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsGenerating(true)
    setError('')
    try {
      await api.post('/reports/', {
        name: reportName || `Report — ${new Date().toLocaleDateString()}`,
        schedule: schedule || null,
      })
      setReportName('')
      setSchedule('')
      await fetchReports()
    } catch (err: any) {
      const message = typeof err.message === 'object' ? JSON.stringify(err.message) : err.message
      setError(message || 'Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = (report: any) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report.data || {}, null, 2))
    const a = document.createElement('a')
    a.setAttribute('href', dataStr)
    a.setAttribute('download', `${report.name.replace(/\s+/g, '_')}_report.json`)
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Scheduled reports are regenerated automatically via Celery Beat
          </p>
        </div>

        {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-500">{error}</div>}

        {/* Create form */}
        <form onSubmit={handleGenerateReport} className="mb-8 bg-white rounded-xl shadow-sm p-6 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
            <input
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder={`Report — ${new Date().toLocaleDateString()}`}
            />
          </div>
          <div className="w-60">
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
            <select
              value={schedule}
              onChange={e => setSchedule(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">One-off (no schedule)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <button type="submit" disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded disabled:opacity-50">
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
        </form>

        {/* Reports table */}
        <div className="rounded-xl bg-white p-6 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No reports yet. Generate one above!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Run</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Run</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report: any) => (
                    <tr key={report.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{report.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {report.schedule ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {SCHEDULE_LABELS[report.schedule] || report.schedule}
                          </span>
                        ) : (
                          <span className="text-gray-400">One-off</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {report.last_run_at ? new Date(report.last_run_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {report.next_run_at ? new Date(report.next_run_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleDownload(report)}
                          className="text-blue-600 hover:text-blue-900">Download JSON</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
