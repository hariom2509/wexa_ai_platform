"use client"

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'

export default function Events() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [newEvent, setNewEvent] = useState({
    event_type: 'error',
    severity: 'high',
    source: 'system-test',
    message: '',
    metadata: '{}'
  })

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const data = await api.get('/events/')
      setEvents(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError('')
    try {
      await api.post('/events/', {
        event_type: newEvent.event_type,
        payload: {
          severity: newEvent.severity,
          message: newEvent.message || 'Test event generated from UI'
        }
      })
      await fetchEvents()
      setNewEvent({ ...newEvent, message: '' }) // reset form
    } catch (err: any) {
      // API error handling
      const message = typeof err.message === 'object' ? JSON.stringify(err.message) : err.message
      setError(message || 'Failed to create event')
    } finally {
      setIsCreating(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const token = localStorage.getItem('token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api'}/events/upload-csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || 'Failed to upload CSV')
      }
      
      await fetchEvents()
      alert('CSV uploaded successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to upload CSV')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Events</h1>
        </div>

        {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-500">{error}</div>}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Create Event Form */}
          <div className="lg:col-span-1">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Simulate Event</h2>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Event Type</label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    value={newEvent.event_type}
                    onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                  >
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Severity</label>
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    value={newEvent.severity}
                    onChange={(e) => setNewEvent({ ...newEvent, severity: e.target.value })}
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Message</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    value={newEvent.message}
                    onChange={(e) => setNewEvent({ ...newEvent, message: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
                >
                  {isCreating ? 'Creating...' : 'Create Event'}
                </button>
              </form>
            </div>
            
            <div className="rounded-xl bg-white p-6 shadow-sm mt-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Upload CSV</h2>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                    </svg>
                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">{isUploading ? 'Uploading...' : 'Click to upload'}</span> or drag and drop</p>
                    <p className="text-xs text-gray-500">CSV file (must contain event_name column)</p>
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={isUploading} />
                </label>
              </div>
            </div>
          </div>

          {/* Events List */}
          <div className="lg:col-span-2">
            <div className="rounded-xl bg-white p-6 shadow-sm overflow-hidden">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Event History</h2>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No events found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {events.map((event: any) => (
                        <tr key={event.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(event.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {event.event_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              event.payload?.severity === 'critical' ? 'bg-red-100 text-red-800' :
                              event.payload?.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                              event.payload?.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {event.payload?.severity || 'info'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {event.payload?.message || 'N/A'}
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
      </div>
    </div>
  )
}
