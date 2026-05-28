import './globals.css'
import type { Metadata } from 'next'
import { Navigation } from '@/components/layout/Navigation'

export const metadata: Metadata = {
  title: 'Wexa AI Platform',
  description: 'Production Grade AI Analytics Platform',
}

import { WebSocketProvider } from '@/lib/WebSocketProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <WebSocketProvider>
          <Navigation />
          {children}
        </WebSocketProvider>
      </body>
    </html>
  )
}