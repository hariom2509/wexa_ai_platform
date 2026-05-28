"use client"

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

export default function Settings() {
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState('')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteLoading, setInviteLoading] = useState(false)

  const fetchKeys = async () => {
    try {
      setLoading(true)
      const data = await api.get('/keys/')
      setApiKeys(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = await api.post('/keys/', { name: newKeyName })
      setCreatedKey(data.raw_key)
      setNewKeyName('')
      await fetchKeys()
    } catch (err: any) {
      alert(err.message || 'Failed to create API key')
    }
  }

  const handleRevokeKey = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return
    try {
      await api.delete(`/keys/${id}`)
      await fetchKeys()
    } catch (err: any) {
      alert(err.message || 'Failed to revoke API key')
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    try {
      await api.post('/auth/invite', { email: inviteEmail, role: inviteRole })
      alert(`Invitation sent to ${inviteEmail}! Check the server logs for the token since email delivery is mocked.`)
      setInviteEmail('')
    } catch (err: any) {
      alert(err.message || 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-4xl font-bold text-gray-900">Organization Settings</h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* API Keys */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-gray-900">API Keys</h2>
            <p className="mb-4 text-sm text-gray-500">Generate API keys to ingest data from external sources.</p>

            {createdKey && (
              <div className="mb-6 rounded-md bg-green-50 p-4 border border-green-200">
                <p className="text-sm font-medium text-green-800 mb-2">Key generated successfully! Copy it now, you won't be able to see it again:</p>
                <code className="block p-2 bg-white border border-green-200 rounded text-sm break-all">{createdKey}</code>
                <button onClick={() => setCreatedKey('')} className="mt-3 text-sm text-green-600 hover:text-green-800 underline">Dismiss</button>
              </div>
            )}

            <form onSubmit={handleCreateKey} className="mb-6 flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. Production Server"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <button
                type="submit"
                className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Generate Key
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prefix</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {apiKeys.map((key) => (
                    <tr key={key.id}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{key.name}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{key.prefix}...</td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleRevokeKey(key.id)} className="text-red-600 hover:text-red-900">Revoke</button>
                      </td>
                    </tr>
                  ))}
                  {apiKeys.length === 0 && !loading && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">No active API keys</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Team Invites */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Invite Team Members</h2>
            <p className="mb-4 text-sm text-gray-500">Invite colleagues to your organization.</p>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="analyst">Analyst</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviteLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
              >
                {inviteLoading ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
