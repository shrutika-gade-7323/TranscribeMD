import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJob, approveSegment, updateTranscript, resolveFlag } from '../services/api'
import type { Job, Segment, QAFlag } from '../types'
import StatusBadge from '../components/StatusBadge'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  ArrowLeft, Play, Pause, SkipBack, Volume2, Download,
  CheckCircle2, AlertTriangle, Info, AlertCircle,
  Edit2, Save, X, Loader2, ExternalLink, ChevronDown
} from 'lucide-react'

// --- Audio Player Component ---
function AudioPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="bg-slate-900 rounded-xl p-4 text-white">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={e => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, current - 5) }}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <SkipBack className="w-4 h-4" />
        </button>
        <button onClick={toggle}
          className="w-10 h-10 rounded-full bg-brand-600 hover:bg-brand-700 flex items-center justify-center transition-colors shrink-0">
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <div className="flex-1">
          <input
            type="range" min={0} max={duration || 1} value={current} step={0.1}
            onChange={e => { if (audioRef.current) audioRef.current.currentTime = +e.target.value; setCurrent(+e.target.value) }}
            className="w-full h-1.5 accent-brand-500"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{fmt(current)}</span><span>{fmt(duration)}</span>
          </div>
        </div>
        <Volume2 className="w-4 h-4 text-slate-400" />
      </div>
      <div className="text-xs text-slate-400 text-center">
        Press Space to play/pause · Click waveform to seek
      </div>
    </div>
  )
}

// --- QA Flag Item ---
function FlagItem({ flag, onResolve }: { flag: QAFlag; onResolve: (id: string) => void }) {
  const icons = {
    INFO: <Info className="w-4 h-4 text-blue-500" />,
    WARNING: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    ERROR: <AlertCircle className="w-4 h-4 text-red-500" />,
  }
  return (
    <div className={clsx(
      'p-3 rounded-lg border text-sm',
      flag.resolved && 'opacity-50',
      flag.severity === 'ERROR' && 'bg-red-50 border-red-200',
      flag.severity === 'WARNING' && 'bg-amber-50 border-amber-200',
      flag.severity === 'INFO' && 'bg-blue-50 border-blue-200',
    )}>
      <div className="flex items-start gap-2">
        {icons[flag.severity]}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-700">{flag.category}</div>
          <div className="text-slate-600 mt-0.5">{flag.message}</div>
        </div>
        {!flag.resolved && (
          <button onClick={() => onResolve(flag.id)}
            className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 hover:bg-slate-50 whitespace-nowrap">
            Resolve
          </button>
        )}
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const { id: jobId, segmentId } = useParams<{ id: string; segmentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: job } = useQuery<Job>({
    queryKey: ['job', jobId],
    queryFn: () => fetchJob(jobId!),
    enabled: !!jobId,
  })

  const segment: Segment | undefined = job?.segments.find(s => s.id === segmentId)

  const [editingTranscript, setEditingTranscript] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    if (segment?.rawTranscript) setEditedTranscript(segment.rawTranscript)
  }, [segment?.rawTranscript])

  const handleSaveTranscript = async () => {
    if (!segmentId) return
    setSaving(true)
    try {
      await updateTranscript(segmentId, editedTranscript)
      toast.success('Transcript updated — document regenerating…')
      setEditingTranscript(false)
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
    } catch {
      toast.error('Failed to update transcript')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!segmentId) return
    setApproving(true)
    try {
      await approveSegment(segmentId)
      toast.success('Segment approved!')
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      navigate(`/jobs/${jobId}`)
    } catch {
      toast.error('Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  const handleResolveFlag = async (flagId: string) => {
    if (!segmentId) return
    try {
      await resolveFlag(segmentId, flagId)
      toast.success('Flag resolved')
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
    } catch {
      toast.error('Failed to resolve flag')
    }
  }

  if (!job || !segment) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  const audioUrl = `/api/v1/files/jobs/${jobId}/audio/${job.audioFileName}`
  const unresolvedFlags = segment.qaFlags.filter(f => !f.resolved)

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to={`/jobs/${jobId}`} className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-semibold text-slate-900 text-sm">
              {segment.extractedPatientName ?? 'Unknown Patient'} — Segment {segment.sequenceIndex + 1}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={segment.status} size="sm" />
              {unresolvedFlags.length > 0 && (
                <span className="badge bg-amber-100 text-amber-700">
                  <AlertTriangle className="w-3 h-3" /> {unresolvedFlags.length} unresolved
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/v1/segments/${segmentId}/document/download`}
            download
            className="btn-secondary text-sm"
          >
            <Download className="w-4 h-4" /> Download .docx
          </a>
          <button
            onClick={handleApprove}
            disabled={approving || segment.status === 'APPROVED'}
            className={clsx(
              'btn text-sm',
              segment.status === 'APPROVED'
                ? 'bg-green-100 text-green-700 cursor-default'
                : 'btn-primary'
            )}
          >
            {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {segment.status === 'APPROVED' ? 'Approved' : 'Approve Segment'}
          </button>
        </div>
      </div>

      {/* 3-pane layout */}
      <div className="flex-1 overflow-hidden flex divide-x divide-slate-200">
        {/* Left pane: Audio + Transcript (40%) */}
        <div className="w-2/5 flex flex-col overflow-hidden">
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Audio Player */}
            <AudioPlayer audioUrl={audioUrl} />

            {/* Transcript */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Transcript</h3>
                <div className="flex items-center gap-2">
                  {editingTranscript ? (
                    <>
                      <button onClick={() => setEditingTranscript(false)}
                        className="btn-secondary text-xs py-1 px-2">
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      <button onClick={handleSaveTranscript} disabled={saving}
                        className="btn-primary text-xs py-1 px-2">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save & Regenerate
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setEditingTranscript(true)}
                      className="btn-secondary text-xs py-1 px-2">
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>
              </div>

              {editingTranscript ? (
                <textarea
                  value={editedTranscript}
                  onChange={e => setEditedTranscript(e.target.value)}
                  className="w-full h-64 text-sm font-mono p-3 border border-brand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                />
              ) : (
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto font-mono bg-slate-50 p-3 rounded-lg">
                  {segment.rawTranscript || <span className="text-slate-400 italic">No transcript available</span>}
                </div>
              )}
            </div>

            {/* QA Flags */}
            {segment.qaFlags.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  QA Flags ({unresolvedFlags.length} unresolved)
                </h3>
                <div className="space-y-2">
                  {segment.qaFlags.map(flag => (
                    <FlagItem key={flag.id} flag={flag} onResolve={handleResolveFlag} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center pane: Document Preview (40%) */}
        <div className="w-2/5 flex flex-col overflow-hidden bg-slate-100">
          <div className="px-4 py-3 bg-white border-b border-slate-200 shrink-0">
            <h3 className="text-sm font-semibold text-slate-700">Document Preview</h3>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            {segment.document ? (
              <iframe
                src={`/api/v1/segments/${segmentId}/document/preview`}
                className="w-full h-full bg-white rounded-xl shadow border border-slate-200"
                title="Document preview"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-center text-slate-500">
                <div>
                  <Loader2 className="w-10 h-10 animate-spin text-brand-400 mx-auto mb-3" />
                  <p>Document is being generated…</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right pane: Controls (20%) */}
        <div className="w-1/5 overflow-y-auto p-4 space-y-4">
          {/* Patient Info */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Patient</h3>
            <div className="space-y-1.5 text-sm">
              <div>
                <span className="text-slate-500">Name: </span>
                <span className="font-medium">{segment.extractedPatientName ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">MRN: </span>
                <span className="font-medium">{segment.extractedMrn ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">DOB: </span>
                <span className="font-medium">{segment.extractedDob ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Template */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Template</h3>
            {segment.template ? (
              <div className="text-sm">
                <div className="font-medium text-slate-800">{segment.template.name}</div>
                {segment.template.procedureType && (
                  <div className="text-slate-500 mt-0.5">{segment.template.procedureType}</div>
                )}
                {segment.templateMatchConfidence && (
                  <div className="mt-2">
                    <div className="text-xs text-slate-500 mb-1">
                      Match: {Math.round(segment.templateMatchConfidence * 100)}%
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200">
                      <div
                        className="h-1.5 rounded-full bg-brand-500"
                        style={{ width: `${segment.templateMatchConfidence * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No template matched</p>
            )}
          </div>

          {/* Images */}
          {job.images.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Images</h3>
              <div className="space-y-2">
                {job.images.map(img => (
                  <div key={img.id} className="flex items-center gap-2 text-xs">
                    <span className="w-5 h-5 rounded bg-slate-200 flex items-center justify-center font-mono font-bold text-slate-600">
                      {img.sequenceNumber}
                    </span>
                    <span className="truncate text-slate-600">{img.fileName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keyboard shortcuts */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Shortcuts</h3>
            <div className="space-y-1.5 text-xs">
              {[['Space', 'Play / Pause'], ['A', 'Approve'], ['E', 'Edit transcript']].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <kbd className="bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono">{key}</kbd>
                  <span className="text-slate-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
