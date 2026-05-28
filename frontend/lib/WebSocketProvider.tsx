"use client"

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { getAuthToken } from './api'

type WebSocketMessage = {
  type: string
  data: any
}

type WebSocketContextType = {
  isConnected: boolean
  lastMessage: WebSocketMessage | null
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  lastMessage: null,
})

export const useWebSocket = () => useContext(WebSocketContext)

const MAX_RECONNECT_DELAY_MS = 30_000 // cap at 30 seconds
const INITIAL_RECONNECT_DELAY_MS = 1_000

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY_MS)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    const connect = async () => {
      const token = getAuthToken()
      if (!token || !isMounted.current) return

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api'
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!response.ok || !isMounted.current) return
        const user = await response.json()
        const orgId = user.organization_id
        if (!orgId) return

        // Build WS URL: replace http(s) with ws(s), strip /api suffix
        const wsUrl = apiUrl.replace(/^http/, 'ws').replace(/\/api$/, '') + `/ws/${orgId}`

        ws.current = new WebSocket(wsUrl)

        ws.current.onopen = () => {
          if (!isMounted.current) return
          setIsConnected(true)
          reconnectDelay.current = INITIAL_RECONNECT_DELAY_MS // reset backoff on successful connect
        }

        ws.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            setLastMessage(message)
          } catch (e) {
            console.error('Failed to parse WebSocket message', e)
          }
        }

        ws.current.onclose = () => {
          if (!isMounted.current) return
          setIsConnected(false)
          // Exponential backoff reconnect
          const delay = Math.min(reconnectDelay.current, MAX_RECONNECT_DELAY_MS)
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY_MS)
          console.log(`WebSocket closed. Reconnecting in ${delay}ms...`)
          reconnectTimeout.current = setTimeout(connect, delay)
        }

        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error)
          ws.current?.close()
        }
      } catch (e) {
        // If fetch fails (e.g. not logged in), retry after delay
        if (!isMounted.current) return
        const delay = Math.min(reconnectDelay.current, MAX_RECONNECT_DELAY_MS)
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY_MS)
        reconnectTimeout.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      isMounted.current = false
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      ws.current?.close()
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  )
}
