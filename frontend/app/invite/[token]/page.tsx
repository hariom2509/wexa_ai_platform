"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, setAuthToken } from '@/lib/api'

export default function InviteAcceptPage({ params }: { params: { token: string } }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // 1. Accept invite
      const user = await api.post('/auth/accept-invite', {
        token: params.token,
        password
      })
      
      // 2. Auto login
      const loginResponse = await api.post('/auth/login', {
        email: user.email,
        password
      })
      
      if (loginResponse.access_token) {
        setAuthToken(loginResponse.access_token)
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Accept Invitation</h2>
          <p className="mt-2 text-sm text-gray-600">Set a password to join the team</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleAccept}>
          {error && <div className="text-red-500 text-sm text-center">{error}</div>}
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <input
                type="password"
                required
                className="relative block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="Choose a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400"
            >
              {loading ? 'Joining...' : 'Join Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
