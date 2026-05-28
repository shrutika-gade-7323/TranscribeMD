import axios from 'axios'
import type { Job, Template } from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30_000,
})

// Jobs
export const fetchJobs = (): Promise<Job[]> =>
  api.get<Job[]>('/jobs').then(r => r.data)

export const fetchJob = (id: string): Promise<Job> =>
  api.get<Job>(`/jobs/${id}`).then(r => r.data)

export const fetchJobStatus = (id: string) =>
  api.get(`/jobs/${id}/status`).then(r => r.data)

export const createJob = (
  audio: File,
  images: File[],
  clinicId?: string
): Promise<Job> => {
  const form = new FormData()
  form.append('audio', audio)
  images.forEach(img => form.append('images', img))
  if (clinicId) form.append('clinicId', clinicId)
  return api.post<Job>('/jobs', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  }).then(r => r.data)
}

export const reprocessJob = (id: string) =>
  api.post(`/jobs/${id}/reprocess`).then(r => r.data)

// Segments
export const approveSegment = (segmentId: string) =>
  api.post(`/segments/${segmentId}/approve`).then(r => r.data)

export const updateTranscript = (segmentId: string, transcript: string) =>
  api.patch(`/segments/${segmentId}/transcript`, { transcript }).then(r => r.data)

export const resolveFlag = (segmentId: string, flagId: string) =>
  api.post(`/segments/${segmentId}/flags/${flagId}/resolve`).then(r => r.data)

export const getDocumentDownloadUrl = (segmentId: string) =>
  `/api/v1/segments/${segmentId}/document/download`

// Templates
export const fetchTemplates = (): Promise<Template[]> =>
  api.get<Template[]>('/templates').then(r => r.data)

export const uploadTemplate = (
  file: File,
  name: string,
  clinicId?: string,
  procedureType?: string
): Promise<Template> => {
  const form = new FormData()
  form.append('file', file)
  form.append('name', name)
  if (clinicId) form.append('clinicId', clinicId)
  if (procedureType) form.append('procedureType', procedureType)
  return api.post<Template>('/templates', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const deleteTemplate = (id: string) =>
  api.delete(`/templates/${id}`).then(r => r.data)

// Images
export const getImageUrl = (imageId: string) => `/api/v1/images/${imageId}`

// Settings
export interface ApiKeyStatus {
  configured: boolean
  partialKeyHint: string
  source: 'DATABASE' | 'ENVIRONMENT'
  updatedAt: string
}

export const fetchApiKeyStatus = (): Promise<ApiKeyStatus> =>
  api.get<ApiKeyStatus>('/settings/anthropic-key').then(r => r.data)

export const updateApiKey = (apiKey: string): Promise<ApiKeyStatus> =>
  api.post<ApiKeyStatus>('/settings/anthropic-key', { apiKey }).then(r => r.data)

export const verifyApiKey = (
  apiKeyId: string,
  adminApiKey: string,
  saveAsActive: boolean
): Promise<any> =>
  api.post('/settings/anthropic-key/verify', {
    apiKeyId,
    adminApiKey,
    saveAsActive,
  }).then(r => r.data)
