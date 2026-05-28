import React, { useState, useEffect } from 'react'
import {
  Key, RefreshCw, AlertTriangle, CheckCircle2, Shield, Calendar,
  Activity, Eye, EyeOff, Terminal, Sparkles, Database, FileCode,
  Zap, Bot, ToggleLeft, ToggleRight
} from 'lucide-react'
import {
  fetchApiKeyStatus,
  updateApiKey,
  updateProvider,
  verifyApiKey,
  verifyGeminiApiKey,
  ApiKeyStatus
} from '../services/api'

type Provider = 'gemini' | 'anthropic'

export default function SettingsPage() {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [activeTab, setActiveTab] = useState<Provider>('gemini')

  // Key input states per provider
  const [geminiKey, setGeminiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Provider toggle
  const [switchingProvider, setSwitchingProvider] = useState(false)

  // Anthropic verifier
  const [verifyId, setVerifyId] = useState('')
  const [adminKey, setAdminKey] = useState('')
  const [saveAsActive, setSaveAsActive] = useState(false)
  const [showAdminKey, setShowAdminKey] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  // Gemini verifier
  const [geminiVerifyKey, setGeminiVerifyKey] = useState('')
  const [showGeminiVerifyKey, setShowGeminiVerifyKey] = useState(false)
  const [geminiSaveAsActive, setGeminiSaveAsActive] = useState(false)
  const [geminiVerifying, setGeminiVerifying] = useState(false)
  const [geminiVerifyResult, setGeminiVerifyResult] = useState<any>(null)
  const [geminiVerifyError, setGeminiVerifyError] = useState<string | null>(null)

  const loadStatus = async () => {
    try {
      setLoadingStatus(true)
      const data = await fetchApiKeyStatus()
      setStatus(data)
      if (data.activeProvider) setActiveTab(data.activeProvider)
    } catch (err) {
      console.error('Error fetching API key status:', err)
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleSwitchProvider = async (provider: Provider) => {
    if (!status || switchingProvider) return
    try {
      setSwitchingProvider(true)
      const updated = await updateProvider(provider)
      setStatus(updated)
      setActiveTab(provider)
    } catch (err) {
      console.error('Failed to switch provider:', err)
    } finally {
      setSwitchingProvider(false)
    }
  }

  const handleSaveKey = async (e: React.FormEvent, provider: Provider) => {
    e.preventDefault()
    const key = provider === 'gemini' ? geminiKey : anthropicKey
    if (!key.trim()) return

    try {
      setSavingKey(true)
      setSaveMessage(null)
      const updated = await updateApiKey(key.trim(), provider)
      setStatus(updated)
      if (provider === 'gemini') setGeminiKey('')
      else setAnthropicKey('')
      setSaveMessage({ type: 'success', text: `${provider === 'gemini' ? 'Gemini' : 'Anthropic'} API Key saved successfully!` })
      setTimeout(() => setSaveMessage(null), 5000)
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save key.' })
    } finally {
      setSavingKey(false)
    }
  }

  const handleVerifyGemini = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!geminiVerifyKey.trim()) return
    try {
      setGeminiVerifying(true)
      setGeminiVerifyResult(null)
      setGeminiVerifyError(null)
      const result = await verifyGeminiApiKey(geminiVerifyKey.trim(), geminiSaveAsActive)
      setGeminiVerifyResult(result)
      if (geminiSaveAsActive) loadStatus()
    } catch (err: any) {
      setGeminiVerifyError(err.response?.data?.error || err.message || 'Verification failed.')
    } finally {
      setGeminiVerifying(false)
    }
  }

  const handleVerifyAnthropic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifyId.trim() || !adminKey.trim()) return
    try {
      setVerifying(true)
      setVerifyResult(null)
      setVerifyError(null)
      const result = await verifyApiKey(verifyId.trim(), adminKey.trim(), saveAsActive)
      setVerifyResult(result)
      if (saveAsActive) loadStatus()
    } catch (err: any) {
      const errMsg = err.response?.data || err.message || 'Verification failed.'
      try {
        const parsed = typeof errMsg === 'string' ? JSON.parse(errMsg) : errMsg
        setVerifyError(parsed.error || 'Failed to verify key with Anthropic API.')
      } catch {
        setVerifyError(typeof errMsg === 'string' ? errMsg : 'Verification request failed.')
      }
    } finally {
      setVerifying(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    } catch { return dateString }
  }

  const isGeminiActive = status?.activeProvider === 'gemini'

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
          Configure your AI transcription engine. Use <strong>Google Gemini</strong> for a free tier, or <strong>Anthropic Claude</strong> for the original engine.
        </p>
      </header>

      {/* Active Engine Toggle */}
      <div className="card mb-8 p-5 overflow-hidden relative">
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-brand-500 to-indigo-600 absolute top-0 inset-x-0" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-slate-500" />
            <div>
              <div className="text-sm font-bold text-slate-800">Active AI Engine</div>
              <div className="text-xs text-slate-500">
                {loadingStatus ? 'Loading...' : (
                  isGeminiActive
                    ? 'Using Google Gemini — Free tier, no credit card required'
                    : 'Using Anthropic Claude — Paid tier, requires subscription'
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              id="toggle-gemini"
              onClick={() => handleSwitchProvider('gemini')}
              disabled={switchingProvider || loadingStatus}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                isGeminiActive || loadingStatus
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              Google Gemini
              {isGeminiActive && <span className="text-xs bg-emerald-500/20 px-1.5 py-0.5 rounded-full font-bold">FREE</span>}
            </button>
            <button
              id="toggle-anthropic"
              onClick={() => handleSwitchProvider('anthropic')}
              disabled={switchingProvider || loadingStatus}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                !isGeminiActive && !loadingStatus
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Anthropic Claude
            </button>
            {switchingProvider && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin ml-1" />}
          </div>
        </div>
      </div>

      {/* Provider Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {(['gemini', 'anthropic'] as Provider[]).map(tab => (
          <button
            key={tab}
            id={`tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab
                ? tab === 'gemini'
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'gemini' ? <Zap className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {tab === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'}
            {status && (
              <span className={`w-2 h-2 rounded-full ${
                tab === 'gemini' ? (status.geminiConfigured ? 'bg-emerald-400' : 'bg-slate-300')
                  : (status.anthropicConfigured ? 'bg-emerald-400' : 'bg-slate-300')
              }`} />
            )}
          </button>
        ))}
      </div>

      {/* Gemini Panel */}
      {activeTab === 'gemini' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          <div className="lg:col-span-5 space-y-6">
            {/* Status Card */}
            <div className="card overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div className="p-6">
                <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" /> Gemini Key Status
                </h2>
                {loadingStatus ? (
                  <div className="py-6 flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
                    <span className="text-xs text-slate-400">Loading...</span>
                  </div>
                ) : status ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Status</div>
                        <div className="font-semibold text-sm flex items-center gap-1.5 mt-0.5">
                          {status.geminiConfigured ? (
                            <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-emerald-700">Configured</span></>
                          ) : (
                            <><AlertTriangle className="w-4 h-4 text-amber-500" /><span className="text-amber-700">Not Set</span></>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        status.geminiSource === 'DATABASE'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        {status.geminiSource === 'DATABASE' ? <Database className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                        {status.geminiSource}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-400">Key Preview</span>
                      <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-sm rounded-lg border border-slate-800 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="select-all truncate">{status.geminiPartialKeyHint}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-100 pt-3">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Updated:</span>
                      <span className="font-medium text-slate-600">{formatDate(status.geminiUpdatedAt)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Set Gemini Key */}
            <div className="card p-6">
              <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" /> Set Gemini API Key
              </h2>
              <p className="text-slate-400 text-xs mb-4">
                Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-emerald-600 underline hover:text-emerald-800">aistudio.google.com/apikey</a>
              </p>
              <form id="form-save-gemini-key" onSubmit={e => handleSaveKey(e, 'gemini')} className="space-y-4">
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    id="input-gemini-key"
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="input pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button type="submit" id="btn-save-gemini-key" disabled={savingKey || !geminiKey.trim()}
                  className="w-full btn justify-center bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm active:scale-95 disabled:opacity-50">
                  {savingKey ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Gemini Key'}
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

          {/* Gemini Key Verifier */}
          <div className="lg:col-span-7">
            <div className="card overflow-hidden h-full">
              <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div className="p-6">
                <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-emerald-600" /> Gemini Key Inspector
                </h2>
                <p className="text-slate-400 text-xs mb-6">
                  Validates your key against <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-600">generativelanguage.googleapis.com</code> and lists available models.
                </p>
                <form id="form-verify-gemini" onSubmit={handleVerifyGemini} className="space-y-4 mb-6">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Gemini API Key to Verify</label>
                    <div className="relative">
                      <input type={showGeminiVerifyKey ? 'text' : 'password'} id="input-gemini-verify-key"
                        value={geminiVerifyKey} onChange={e => setGeminiVerifyKey(e.target.value)}
                        placeholder="AIzaSy..." className="input pr-10" required />
                      <button type="button" onClick={() => setShowGeminiVerifyKey(!showGeminiVerifyKey)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                        {showGeminiVerifyKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="gemini-save-as-active" checked={geminiSaveAsActive}
                      onChange={e => setGeminiSaveAsActive(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500" />
                    <label htmlFor="gemini-save-as-active" className="text-xs text-slate-600 cursor-pointer select-none">
                      Save as active Gemini key on successful verification
                    </label>
                  </div>
                  <button type="submit" id="btn-verify-gemini" disabled={geminiVerifying || !geminiVerifyKey.trim()}
                    className="w-full btn justify-center bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm active:scale-95 disabled:opacity-50">
                    {geminiVerifying ? <><RefreshCw className="w-4 h-4 animate-spin" /> Verifying...</> : 'Verify Gemini Key'}
                  </button>
                </form>
                {geminiVerifying && (
                  <div className="p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
                    <span className="text-sm font-medium text-slate-500">Contacting googleapis.com...</span>
                  </div>
                )}
                {geminiVerifyError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 text-red-800 animate-fade-in">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-sm">Verification Failed</h3>
                      <p className="text-xs text-red-700 mt-1">{geminiVerifyError}</p>
                    </div>
                  </div>
                )}
                {geminiVerifyResult && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <div>
                        <div className="font-bold text-sm text-emerald-950">Key Verified Successfully</div>
                        <div className="text-xs text-emerald-700">
                          {geminiVerifyResult.models?.length ?? 0} Gemini models accessible with this key.
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950 flex items-center gap-1.5 text-xs">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-slate-400 font-mono">API Response (models)</span>
                      </div>
                      <pre className="p-4 text-xs font-mono text-emerald-400 overflow-auto max-h-[180px] whitespace-pre-wrap select-all leading-relaxed">
                        {JSON.stringify(geminiVerifyResult?.models?.slice(0, 5) ?? geminiVerifyResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anthropic Panel */}
      {activeTab === 'anthropic' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          <div className="lg:col-span-5 space-y-6">
            {/* Status Card */}
            <div className="card overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600" />
              <div className="p-6">
                <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600" /> Claude Key Status
                </h2>
                {loadingStatus ? (
                  <div className="py-6 flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                    <span className="text-xs text-slate-400">Loading...</span>
                  </div>
                ) : status ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Status</div>
                        <div className="font-semibold text-sm flex items-center gap-1.5 mt-0.5">
                          {status.anthropicConfigured ? (
                            <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-emerald-700">Configured</span></>
                          ) : (
                            <><AlertTriangle className="w-4 h-4 text-amber-500" /><span className="text-amber-700">Not Set</span></>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        status.anthropicSource === 'DATABASE'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        {status.anthropicSource === 'DATABASE' ? <Database className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                        {status.anthropicSource}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-400">Key Preview</span>
                      <div className="p-3 bg-slate-900 text-slate-300 font-mono text-sm rounded-lg border border-slate-800 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-brand-400 shrink-0" />
                        <span className="select-all truncate">{status.anthropicPartialKeyHint}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-100 pt-3">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Updated:</span>
                      <span className="font-medium text-slate-600">{formatDate(status.anthropicUpdatedAt)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Set Anthropic Key */}
            <div className="card p-6">
              <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" /> Set Anthropic API Key
              </h2>
              <p className="text-slate-400 text-xs mb-4">
                Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline hover:text-indigo-800">console.anthropic.com</a>
              </p>
              <form id="form-save-anthropic-key" onSubmit={e => handleSaveKey(e, 'anthropic')} className="space-y-4">
                <div className="relative">
                  <input type={showAnthropicKey ? 'text' : 'password'} id="input-anthropic-key"
                    value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..." className="input pr-10" required />
                  <button type="button" onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                    {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button type="submit" id="btn-save-anthropic-key" disabled={savingKey || !anthropicKey.trim()}
                  className="w-full btn justify-center bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-50">
                  {savingKey ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Claude Key'}
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

          {/* Anthropic Verifier */}
          <div className="lg:col-span-7">
            <div className="card overflow-hidden h-full">
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600" />
              <div className="p-6">
                <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" /> Anthropic Key Inspector
                </h2>
                <p className="text-slate-400 text-xs mb-6">
                  Queries the Anthropic Organizations endpoint <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">/v1/organizations/api_keys</code> to verify key metadata.
                </p>
                <form id="form-verify-anthropic" onSubmit={handleVerifyAnthropic} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">API Key ID</label>
                    <input type="text" id="input-anthropic-key-id" value={verifyId} onChange={e => setVerifyId(e.target.value)}
                      placeholder="apikey_01Rj2N8S..." className="input" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Admin API Key</label>
                    <div className="relative">
                      <input type={showAdminKey ? 'text' : 'password'} id="input-anthropic-admin-key"
                        value={adminKey} onChange={e => setAdminKey(e.target.value)}
                        placeholder="sk-ant-..." className="input pr-10" required />
                      <button type="button" onClick={() => setShowAdminKey(!showAdminKey)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                        {showAdminKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <input type="checkbox" id="anthropic-save-as-active" checked={saveAsActive}
                      onChange={e => setSaveAsActive(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                    <label htmlFor="anthropic-save-as-active" className="text-xs text-slate-600 cursor-pointer select-none">
                      Save verified admin key as active Claude key on success
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <button type="submit" id="btn-verify-anthropic" disabled={verifying || !verifyId.trim() || !adminKey.trim()}
                      className="w-full btn justify-center bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-50">
                      {verifying ? <><RefreshCw className="w-4 h-4 animate-spin" /> Verifying...</> : 'Verify & Inspect Key'}
                    </button>
                  </div>
                </form>
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
                      <p className="text-xs text-red-700 mt-1">{verifyError}</p>
                    </div>
                  </div>
                )}
                {verifyResult && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <div>
                          <div className="font-bold text-sm text-emerald-950">Successfully Verified</div>
                          <div className="text-xs text-emerald-700">The key is recognized by the Anthropic organizations API.</div>
                        </div>
                      </div>
                      <span className="badge bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 uppercase px-3 py-1">
                        {verifyResult.status || 'Active'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Key Details</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">Name:</span><span className="font-semibold text-slate-800">{verifyResult.name || 'N/A'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">ID:</span><span className="font-mono text-xs text-slate-700 select-all">{verifyResult.id}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Created:</span><span className="text-slate-800">{formatDate(verifyResult.created_at)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Expires:</span><span className={`font-semibold ${verifyResult.expires_at ? 'text-amber-700' : 'text-slate-500'}`}>{verifyResult.expires_at ? formatDate(verifyResult.expires_at) : 'Never'}</span></div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                        <div className="px-4 py-2 border-b border-slate-800 bg-slate-950 flex items-center gap-1.5 text-xs">
                          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-slate-400 font-mono">Response JSON</span>
                        </div>
                        <pre className="p-4 text-xs font-mono text-emerald-400 overflow-auto max-h-[180px] select-all leading-relaxed whitespace-pre-wrap">
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
      )}
    </div>
  )
}
