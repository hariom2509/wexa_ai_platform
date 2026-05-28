"use client"

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

export default function Events() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
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
