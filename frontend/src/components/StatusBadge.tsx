import type { JobStatus, SegmentStatus } from '../types'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  UPLOADED:          { label: 'Uploaded',          classes: 'bg-slate-100 text-slate-600' },
  DENOISING:         { label: 'Denoising',          classes: 'bg-blue-100 text-blue-700' },
  TRANSCRIBING:      { label: 'Transcribing',       classes: 'bg-blue-100 text-blue-700' },
  SEGMENTING:        { label: 'Segmenting',         classes: 'bg-indigo-100 text-indigo-700' },
  ANNOTATING:        { label: 'Annotating',         classes: 'bg-purple-100 text-purple-700' },
  ASSEMBLING:        { label: 'Assembling Docs',    classes: 'bg-violet-100 text-violet-700' },
  QA_REVIEW:         { label: 'QA Review',          classes: 'bg-yellow-100 text-yellow-700' },
  READY_FOR_REVIEW:  { label: 'Ready for Review',   classes: 'bg-amber-100 text-amber-700' },
  REVIEWED:          { label: 'Reviewed',           classes: 'bg-green-100 text-green-700' },
  EXPORTED:          { label: 'Exported',           classes: 'bg-emerald-100 text-emerald-700' },
  FAILED:            { label: 'Failed',             classes: 'bg-red-100 text-red-700' },
  PROCESSING:        { label: 'Processing',         classes: 'bg-blue-100 text-blue-700' },
  ASSEMBLED:         { label: 'Assembled',          classes: 'bg-amber-100 text-amber-700' },
  QA_FLAGGED:        { label: 'QA Flagged',         classes: 'bg-yellow-100 text-yellow-700' },
  NEEDS_REVIEW:      { label: 'Needs Review',       classes: 'bg-orange-100 text-orange-700' },
  APPROVED:          { label: 'Approved',           classes: 'bg-green-100 text-green-700' },
  REJECTED:          { label: 'Rejected',           classes: 'bg-red-100 text-red-700' },
}

const PROCESSING_STATES = new Set([
  'DENOISING', 'TRANSCRIBING', 'SEGMENTING', 'ANNOTATING', 'ASSEMBLING', 'QA_REVIEW', 'PROCESSING'
])

interface Props {
  status: JobStatus | SegmentStatus
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, classes: 'bg-gray-100 text-gray-700' }
  const isProcessing = PROCESSING_STATES.has(status)

  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
      config.classes
    )}>
      {isProcessing && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {config.label}
    </span>
  )
}
