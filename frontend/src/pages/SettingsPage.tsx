import React, { useState, useEffect } from 'react'
import {
  Key, RefreshCw, AlertTriangle, CheckCircle2, Shield, Calendar,
  Activity, Eye, EyeOff, Terminal, Sparkles, Database, FileCode
} from 'lucide-react'
import {
  fetchApiKeyStatus,
  updateApiKey,
  verifyApiKey,
  ApiKeyStatus
} from '../services/api'

export default function SettingsPage() {
  // Key status state
  const [status, setStatus] = useState<ApiKeyStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  // Direct replace states
  const [newKey, setNewKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Verifier states
  const [verifyId, setVerifyId] = useState('')
  const [adminKey, setAdminKey] = useState('')
  const [saveAsActive, setSaveAsActive] = useState(false)
  const [showAdminKey, setShowAdminKey] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  // Fetch status on load
  const loadStatus = async () => {
    try {
      setLoadingStatus(true)
      const data = await fetchApiKeyStatus()
      setStatus(data)
    } catch (err) {
      console.error('Error fetching API key status:', err)
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  // Handle direct update
  const handleUpdateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKey.trim()) return

    try {
      setSavingKey(true)
      setSaveMessage(null)
      const updated = await updateApiKey(newKey.trim())
      setStatus(updated)
      setNewKey('')
      setSaveMessage({ type: 'success', text: 'API Key updated successfully in database settings!' })
      setTimeout(() => setSaveMessage(null), 5000)
    } catch (err: any) {
      setSaveMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update API Key. Please try again.'
      })
    } finally {
      setSavingKey(false)
    }
  }

  // Handle verify key
  const handleVerifyKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifyId.trim() || !adminKey.trim()) return

    try {
      setVerifying(true)
      setVerifyResult(null)
      setVerifyError(null)

      const result = await verifyApiKey(verifyId.trim(), adminKey.trim(), saveAsActive)
      setVerifyResult(result)
      
      if (saveAsActive) {
        // Reload settings status if we saved verified key as active
        loadStatus()
      }
    } catch (err: any) {
      const errMessage = err.response?.data || err.message || 'Verification failed.'
      // Try to parse json error
      try {
        const parsed = typeof errMessage === 'string' ? JSON.parse(errMessage) : errMessage
        setVerifyError(parsed.error || 'Failed to verify key with Anthropic API.')
      } catch {
        setVerifyError(typeof errMessage === 'string' ? errMessage : 'Verification request failed.')
      }
    } finally {
      setVerifying(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
            <Key className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Settings</h1>
        </div>
        <p className="text-slate-500 text-sm max-w-2xl">
          Manage system configurations, replace the Anthropic AI engine credentials, and verify API keys.
        </p>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Active Status & Replace Form */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Active Key Status Card */}
          <div className="card overflow-hidden relative">
            {/* Top decoration gradient */}
            <div className="h-1.5 bg-gradient-to-r from-brand-500 to-indigo-600" />
            
            <div className="p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-600" /> Active API Key
              </h2>

              {loadingStatus ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
                  <span className="text-xs text-slate-400">Loading settings...</span>
                </div>
              ) : status ? (
                <div className="space-y-4">
                  
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Status</div>
                      <div className="font-semibold text-sm text-slate-700 flex items-center gap-1.5 mt-0.5">
                        {status.configured ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                            <span className="text-emerald-700">Configured & Active</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span className="text-amber-700">Not Configured</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 uppercase font-bold tracking-wider text-right">Source</div>
                      <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        status.source === 'DATABASE' 
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        {status.source === 'DATABASE' ? <Database className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                        {status.source}
                      </span>
                    </div>
                  </div>

                  {/* Partial Hint */}
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-400">Active Key Hint</span>
                    <div className="p-3 bg-slate-900 text-slate-300 font-mono text-sm rounded-lg border border-slate-800 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-brand-400" />
                      <span className="select-all">{status.partialKeyHint}</span>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-100 pt-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Updated:
                    </span>
                    <span className="font-medium text-slate-600">
                      {formatDate(status.updatedAt)}
                    </span>
                  </div>

                </div>
              ) : (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                  Failed to fetch configuration status.
                </div>
              )}
            </div>
          </div>

          {/* Replace API Key Card */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" /> Replace Active Key
            </h2>
            <p className="text-slate-400 text-xs mb-4">
              Directly override the dynamic Anthropic transcription API Key stored in database settings.
            </p>

            <form onSubmit={handleUpdateKey} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">New Anthropic API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="input pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingKey || !newKey.trim()}
                className="w-full btn-primary justify-center transition-all shadow-md active:scale-95"
              >
                {savingKey ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving Key...
                  </>
                ) : (
                  'Save & Apply Key'
                )}
              </button>

              {saveMessage && (
                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 animate-fade-in ${
                  saveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {saveMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{saveMessage.text}</span>
                </div>
              )}
            </form>
          </div>

        </div>

        {/* Right Side: Key Inspector & Verifier */}
        <div className="lg:col-span-7">
          <div className="card overflow-hidden">
            {/* Header border */}
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600" />
            
            <div className="p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-600" /> Anthropic Key Inspector
              </h2>
              <p className="text-slate-400 text-xs mb-6">
                Queries the Anthropic Organizations endpoint <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">/v1/organizations/api_keys</code> to verify details, credentials metadata, and status.
              </p>

              <form onSubmit={handleVerifyKey} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">API Key ID</label>
                  <input
                    type="text"
                    value={verifyId}
                    onChange={(e) => setVerifyId(e.target.value)}
                    placeholder="apikey_01Rj2N8S..."
                    className="input"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Admin API Key</label>
                  <div className="relative">
                    <input
                      type={showAdminKey ? 'text' : 'password'}
                      value={adminKey}
                      onChange={(e) => setAdminKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminKey(!showAdminKey)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showAdminKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2 flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="saveAsActiveCheckbox"
                    checked={saveAsActive}
                    onChange={(e) => setSaveAsActive(e.target.checked)}
                    className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                  />
                  <label htmlFor="saveAsActiveCheckbox" className="text-xs text-slate-600 cursor-pointer select-none">
                    Save verified admin key as the active transcription API Key upon successful check
                  </label>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={verifying || !verifyId.trim() || !adminKey.trim()}
                    className="w-full btn bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm justify-center transition-all duration-150 active:scale-95 disabled:opacity-50"
                  >
                    {verifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Credentials...
                      </>
                    ) : (
                      'Verify & Inspect Key'
                    )}
                  </button>
                </div>
              </form>

              {/* Verify Results Display */}
              {verifying && (
                <div className="p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                    <Key className="w-4 h-4 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <span className="text-sm font-medium text-slate-500">Contacting api.anthropic.com...</span>
                </div>
              )}

              {verifyError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 text-red-800 animate-fade-in">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-sm">Verification Failed</h3>
                    <p className="text-xs text-red-700 mt-1 leading-relaxed">{verifyError}</p>
                  </div>
                </div>
              )}

              {verifyResult && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Status header banner */}
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <div>
                        <div className="font-bold text-sm text-emerald-950">Successfully Verified</div>
                        <div className="text-xs text-emerald-700">The key is recognized by Anthropic organizations API.</div>
                      </div>
                    </div>
                    <span className="badge bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 uppercase px-3 py-1">
                      {verifyResult.status || 'Active'}
                    </span>
                  </div>

                  {/* Split Display: Metadata details & raw JSON */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Metadata Card */}
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3.5">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Key Details</h3>
                      
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Key Name:</span>
                          <span className="font-semibold text-slate-800">{verifyResult.name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">ID:</span>
                          <span className="font-mono text-xs text-slate-700 select-all">{verifyResult.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Workspace ID:</span>
                          <span className="font-mono text-xs text-slate-700 select-all">{verifyResult.workspace_id || 'Default'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Created:</span>
                          <span className="text-slate-800">{formatDate(verifyResult.created_at)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Expires:</span>
                          <span className={`font-semibold ${verifyResult.expires_at ? 'text-amber-700' : 'text-slate-500'}`}>
                            {verifyResult.expires_at ? formatDate(verifyResult.expires_at) : 'Never'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Raw JSON View */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col h-full min-h-[220px]">
                      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Response JSON
                        </span>
                      </div>
                      <pre className="p-4 text-xs font-mono text-emerald-400 overflow-auto flex-1 select-all leading-relaxed whitespace-pre-wrap max-h-[180px]">
                        {JSON.stringify(verifyResult, null, 2)}
                      </pre>
                    </div>

                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
