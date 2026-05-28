"use client"

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useWebSocket } from '@/lib/WebSocketProvider'

export default function LiveStream() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isConnected, lastMessage } = useWebSocket()

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const data = await api.get('/events/')
        setEvents(data.slice(0, 20)) // Get last 20 events initially
      } catch (err) {
        console.error("Failed to fetch initial events")
      } finally {
        setLoading(false)
      }
    }
    fetchRecent()
  }, [])

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'new_event') {
      setEvents(prev => [lastMessage.data, ...prev].slice(0, 100)) // Keep max 100 in stream
    }
  }, [lastMessage])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-mono font-bold text-green-400">
            &gt; Live Event Stream
          </h1>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-mono text-gray-400">Connection Status:</span>
            {isConnected ? (
              <span className="flex items-center text-sm font-mono text-green-400">
                <span className="h-2 w-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                Connected
              </span>
            ) : (
              <span className="flex items-center text-sm font-mono text-red-500">
                <span className="h-2 w-2 bg-red-500 rounded-full mr-2"></span>
                Disconnected
              </span>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm border border-gray-700 shadow-xl overflow-hidden">
          <div className="h-[600px] overflow-y-auto flex flex-col gap-2">
            {loading ? (
              <div className="text-gray-500 italic">Initializing secure tunnel...</div>
            ) : events.length === 0 ? (
              <div className="text-gray-500 italic">Listening for events...</div>
            ) : (
              events.map((event, i) => (
                <div key={event.id || i} className="bg-gray-900 p-3 rounded border border-gray-700 flex flex-col">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>ID: {event.id}</span>
                    <span>{new Date(event.created_at || Date.now()).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-start">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold mr-3 ${
                      event.event_type === 'error' ? 'bg-red-900/50 text-red-400' :
                      event.event_type === 'warning' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-blue-900/50 text-blue-400'
                    }`}>
                      [{event.event_type.toUpperCase()}]
                    </span>
                    <span className="text-gray-300 break-all">
                      {JSON.stringify(event.payload)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
