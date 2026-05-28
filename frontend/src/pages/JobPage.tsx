import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJob, reprocessJob } from '../services/api'
import type { Job, Segment, StatusEvent } from '../types'
import StatusBadge from '../components/StatusBadge'
import {
  ArrowLeft, FileAudio, User, Clock, CheckCircle2,
  AlertTriangle, ChevronRight, Download, Loader2,
  RotateCcw, Image as ImageIcon
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const PIPELINE_STEPS = [
  { key: 'UPLOADED',         label: 'Uploaded' },
  { key: 'TRANSCRIBING',     label: 'Transcription' },
  { key: 'SEGMENTING',       label: 'Patient Segmentation' },
  { key: 'ANNOTATING',       label: 'AI Annotation' },
  { key: 'ASSEMBLING',       label: 'Document Assembly' },
  { key: 'READY_FOR_REVIEW', label: 'Ready for Review' },
]

const ORDER: Record<string, number> = Object.fromEntries(PIPELINE_STEPS.map((s, i) => [s.key, i]))

function PipelineProgress({ status, log }: { status: string; log: string[] }) {
  const currentIdx = ORDER[status] ?? (status === 'FAILED' ? -1 : 0)
  const isFailed = status === 'FAILED'

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Processing Pipeline</h3>
      <div className="space-y-2">
        {PIPELINE_STEPS.map((step, idx) => {
          const done = !isFailed && currentIdx > idx
          const active = !isFailed && currentIdx === idx
          const pending = isFailed ? false : currentIdx < idx
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                done   && 'bg-green-100 text-green-600',
                active && 'bg-brand-100 text-brand-600',
                pending && 'bg-slate-100 text-slate-400',
                isFailed && idx === 0 && 'bg-red-100 text-red-600',
              )}>
                {done ? '✓' : idx + 1}
              </div>
              <span className={clsx(
                'text-sm',
                done && 'text-slate-600',
                active && 'text-brand-700 font-medium',
                pending && 'text-slate-400',
              )}>
                {step.label}
                {active && <span className="ml-2 inline-flex items-center gap-1 text-xs text-brand-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" /> In progress…
                </span>}
              </span>
            </div>
          )
        })}
      </div>
      {log.length > 0 && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg max-h-28 overflow-y-auto">
          {log.slice(-5).map((entry, i) => (
            <div key={i} className="text-xs text-slate-600 font-mono">{entry}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function SegmentCard({ seg, jobId }: { seg: Segment; jobId: string }) {
  const navigate = useNavigate()
  const isReady = ['ASSEMBLED', 'QA_FLAGGED', 'NEEDS_REVIEW', 'APPROVED'].includes(seg.status)

  return (
    <div
      className={clsx(
        'card p-4 transition-all',
        isReady ? 'cursor-pointer hover:shadow-md hover:border-brand-200' : 'opacity-70',
      )}
      onClick={() => isReady && navigate(`/jobs/${jobId}/review/${seg.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-600 text-sm">
            {seg.sequenceIndex + 1}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">
              {seg.extractedPatientName ?? 'Unknown Patient'}
            </div>
            {seg.extractedMrn && (
              <div className="text-xs text-slate-500">MRN: {seg.extractedMrn}</div>
            )}
          </div>
        </div>
        <StatusBadge status={seg.status} size="sm" />
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        {seg.template && (
          <span className="flex items-center gap-1">
            <FileAudio className="w-3 h-3" />
            {seg.template.name}
            {seg.templateMatchConfidence && (
              <span className="text-slate-400">({Math.round(seg.templateMatchConfidence * 100)}%)</span>
            )}
          </span>
        )}
        {seg.unresolvedFlagCount > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            {seg.unresolvedFlagCount} flag{seg.unresolvedFlagCount > 1 ? 's' : ''}
          </span>
        )}
        {seg.document?.approved && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        )}
      </div>

      {isReady && (
        <div className="mt-3 flex items-center justify-between">
          <a
            href={`/api/v1/segments/${seg.id}/document/download`}
            download
            onClick={e => e.stopPropagation()}
            className="text-xs flex items-center gap-1 text-brand-600 hover:text-brand-800"
          >
            <Download className="w-3 h-3" /> Download .docx
          </a>
          {isReady && (
            <span className="text-xs flex items-center gap-1 text-slate-500">
              Review <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [statusLog, setStatusLog] = useState<string[]>([])

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ['job', id],
    queryFn: () => fetchJob(id!),
    refetchInterval: (query) => {
      const status = (query.state.data as Job | undefined)?.status
      const done = ['READY_FOR_REVIEW', 'REVIEWED', 'EXPORTED', 'FAILED']
      return done.includes(status ?? '') ? false : 3000
    },
    enabled: !!id,
  })

  // SSE for real-time updates
  useEffect(() => {
    if (!id) return
    const es = new EventSource(`/api/v1/jobs/${id}/events`)
    es.onmessage = (e) => {
      try {
        const event: StatusEvent = JSON.parse(e.data)
        setStatusLog(prev => [...prev, `[${new Date(event.timestamp).toLocaleTimeString()}] ${event.message}`])
        queryClient.invalidateQueries({ queryKey: ['job', id] })
      } catch {}
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [id, queryClient])

  if (isLoading || !job) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  const isProcessing = !['READY_FOR_REVIEW','REVIEWED','EXPORTED','FAILED'].includes(job.status)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-slate-900 truncate max-w-lg">
              {job.audioFileName ?? 'Untitled Job'}
            </h1>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{job.id.slice(0, 16)}…</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
            </span>
            {job.durationSeconds && (
              <span className="flex items-center gap-1">
                <FileAudio className="w-3 h-3" />
                {Math.floor(job.durationSeconds / 60)}m {Math.floor(job.durationSeconds % 60)}s
              </span>
            )}
          </div>
        </div>
        {job.status === 'FAILED' && (
          <button
            onClick={async () => { await reprocessJob(job.id); toast.success('Reprocessing started') }}
            className="btn-secondary text-sm"
          >
            <RotateCcw className="w-4 h-4" /> Retry
          </button>
        )}
      </div>

      {/* Error */}
      {job.errorDetails && (
        <div className="mb-5 p-4 bg-red-50 rounded-xl border border-red-200 text-sm text-red-700">
          <strong>Error:</strong> {job.errorDetails}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left — pipeline + images */}
        <div className="col-span-1 space-y-5">
          <PipelineProgress status={job.status} log={statusLog} />

          {/* Images */}
          {job.images.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Images ({job.images.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {job.images.map(img => (
                  <div key={img.id} className="relative">
                    <img
                      src={img.url}
                      alt={img.fileName}
                      className="w-full h-16 object-cover rounded-lg border border-slate-200"
                      onError={e => (e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="%23f1f5f9"/><text x="30" y="35" text-anchor="middle" fill="%2394a3b8" font-size="10">IMG</text></svg>')}
                    />
                    <span className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1 rounded font-mono">
                      #{img.sequenceNumber}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — segments */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">
              Patient Segments
              {job.totalSegments > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {job.approvedSegments}/{job.totalSegments} approved
                </span>
              )}
            </h2>
          </div>

          {isProcessing && job.segments.length === 0 ? (
            <div className="card p-10 flex flex-col items-center text-center">
              <Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-3" />
              <p className="font-medium text-slate-700">Processing your audio…</p>
              <p className="text-sm text-slate-500 mt-1">
                Transcribing speech, detecting patients, and generating documents.
              </p>
            </div>
          ) : job.segments.length > 0 ? (
            <div className="space-y-3">
              {job.segments.map(seg => (
                <SegmentCard key={seg.id} seg={seg} jobId={job.id} />
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center text-slate-500">
              No segments yet. Check back after processing completes.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
