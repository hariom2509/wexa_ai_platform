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

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let isMounted = true

    const connect = async () => {
      const token = getAuthToken()
      if (!token) return

      try {
        // Fetch user details to get orgId
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api'
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) return
        const user = await response.json()
        const orgId = user.organization_id

        if (!orgId || !isMounted) return

        // Build WS URL
        const wsUrl = apiUrl.replace('http', 'ws').replace('/api', '') + `/ws/${orgId}`

        ws.current = new WebSocket(wsUrl)

        ws.current.onopen = () => {
          setIsConnected(true)
          if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current)
            reconnectTimeout.current = null
          }
        }

        ws.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            setLastMessage(message)
          } catch (e) {
            console.error("Failed to parse websocket message", e)
          }
        }

        ws.current.onclose = () => {
          setIsConnected(false)
          // Attempt to reconnect after 3 seconds
          if (isMounted) {
            reconnectTimeout.current = setTimeout(() => {
              connect()
            }, 3000)
          }
        }

        ws.current.onerror = (error) => {
          console.error("WebSocket error:", error)
          ws.current?.close()
        }
      } catch (e) {
        console.error("Failed to setup websocket", e)
      }
    }

    connect()

    return () => {
      isMounted = false
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      if (ws.current) ws.current.close()
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  )
}
