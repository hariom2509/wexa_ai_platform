"use client"

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

export default function Reports() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

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

  useEffect(() => {
    fetchReports()
  }, [])

  const handleGenerateReport = async () => {
    setIsGenerating(true)
    setError('')
    try {
      await api.post('/reports/', {
        name: `Weekly Summary - ${new Date().toLocaleDateString()}`
      })
      await fetchReports()
    } catch (err: any) {
      // API error handling
      const message = typeof err.message === 'object' ? JSON.stringify(err.message) : err.message
      setError(message || 'Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = (report: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report.data || {}, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `${report.name.replace(/\s+/g, '_')}_report.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Reports</h1>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate New Report'}
          </button>
        </div>

        {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-500">{error}</div>}

        <div className="rounded-xl bg-white p-6 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No reports generated yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Size</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report: any) => (
                    <tr key={report.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        #{report.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {report.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {report.data ? JSON.stringify(report.data).length : 0} bytes
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDownload(report)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Download JSON
                        </button>
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
