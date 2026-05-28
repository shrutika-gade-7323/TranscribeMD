import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { fetchJobs } from '../services/api'
import type { Job } from '../types'
import StatusBadge from '../components/StatusBadge'
import {
  Plus, FileAudio, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, Loader2, RefreshCw
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: React.ElementType; color: string
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  )
}

function JobRow({ job }: { job: Job }) {
  const navigate = useNavigate()
  const isProcessing = ['DENOISING','TRANSCRIBING','SEGMENTING','ANNOTATING','ASSEMBLING','QA_REVIEW'].includes(job.status)

  return (
    <tr
      className="hover:bg-slate-50 cursor-pointer transition-colors"
      onClick={() => navigate(`/jobs/${job.id}`)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <FileAudio className="w-4 h-4 text-brand-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900 truncate max-w-xs">
              {job.audioFileName || 'Unnamed audio'}
            </div>
            <div className="text-xs text-slate-400 font-mono">{job.id.slice(0, 8)}…</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={job.status} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {job.totalSegments > 0
          ? `${job.approvedSegments} / ${job.totalSegments} approved`
          : '—'
        }
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">
        {job.durationSeconds
          ? `${Math.floor(job.durationSeconds / 60)}m ${Math.floor(job.durationSeconds % 60)}s`
          : '—'
        }
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">
        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
      </td>
      <td className="px-4 py-3">
        {isProcessing ? (
          <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </td>
    </tr>
  )
}

export default function DashboardPage() {
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: fetchJobs,
    refetchInterval: 5000, // Poll every 5s for live status
  })

  const total = jobs.length
  const processing = jobs.filter(j => !['UPLOADED','READY_FOR_REVIEW','REVIEWED','EXPORTED','FAILED'].includes(j.status)).length
  const readyForReview = jobs.filter(j => j.status === 'READY_FOR_REVIEW').length
  const failed = jobs.filter(j => j.status === 'FAILED').length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transcription Jobs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage and review your AI-generated medical reports</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="btn-secondary"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link to="/upload" className="btn-primary">
            <Plus className="w-4 h-4" />
            New Job
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Jobs" value={total} icon={FileAudio} color="bg-brand-600" />
        <StatCard label="Processing" value={processing} icon={Loader2} color="bg-blue-500" />
        <StatCard label="Ready for Review" value={readyForReview} icon={CheckCircle2} color="bg-amber-500" />
        <StatCard label="Failed" value={failed} icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* Jobs table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <FileAudio className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No jobs yet</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-sm">
              Upload an audio dictation to get started. The AI will transcribe,
              format, and generate your Word document automatically.
            </p>
            <Link to="/upload" className="btn-primary">
              <Plus className="w-4 h-4" />
              Upload first job
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Audio File</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Segments</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {jobs.map(job => <JobRow key={job.id} job={job} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
