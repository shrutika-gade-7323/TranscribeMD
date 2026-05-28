export type JobStatus =
  | 'UPLOADED'
  | 'DENOISING'
  | 'TRANSCRIBING'
  | 'SEGMENTING'
  | 'ANNOTATING'
  | 'ASSEMBLING'
  | 'QA_REVIEW'
  | 'READY_FOR_REVIEW'
  | 'REVIEWED'
  | 'EXPORTED'
  | 'FAILED'

export type SegmentStatus =
  | 'PROCESSING'
  | 'ASSEMBLED'
  | 'QA_FLAGGED'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export type FlagSeverity = 'INFO' | 'WARNING' | 'ERROR'

export interface Job {
  id: string
  status: JobStatus
  audioFileName: string
  durationSeconds: number | null
  expectedClinicId: string | null
  createdAt: string
  updatedAt: string | null
  errorDetails: string | null
  totalSegments: number
  approvedSegments: number
  segments: Segment[]
  images: ImageFile[]
}

export interface Segment {
  id: string
  sequenceIndex: number
  audioStartSec: number | null
  audioEndSec: number | null
  extractedPatientName: string | null
  extractedMrn: string | null
  extractedDob: string | null
  template: TemplateRef | null
  templateMatchConfidence: number | null
  boundaryConfidence: number | null
  rawTranscript: string | null
  annotatedJson: string | null
  status: SegmentStatus
  document: DocumentRef | null
  qaFlags: QAFlag[]
  unresolvedFlagCount: number
}

export interface TemplateRef {
  id: string
  name: string
  procedureType: string | null
  clinicId: string | null
}

export interface DocumentRef {
  id: string
  downloadUrl: string
  previewUrl: string
  version: number
  approved: boolean
  approvedAt: string | null
}

export interface QAFlag {
  id: string
  severity: FlagSeverity
  category: string
  message: string
  resolved: boolean
}

export interface ImageFile {
  id: string
  fileName: string
  sequenceNumber: number
  visionDescription: string | null
  url: string
}

export interface Template {
  id: string
  name: string
  clinicId: string | null
  procedureType: string | null
  active: boolean
  version: number
  createdAt: string
}

export interface StatusEvent {
  status: string
  message: string
  timestamp: string
}
