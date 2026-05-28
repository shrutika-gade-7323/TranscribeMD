import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTemplates, uploadTemplate, deleteTemplate } from '../services/api'
import type { Template } from '../types'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  FileText, Upload, Plus, Trash2, Clock, Tag,
  Loader2, X, ChevronDown, CheckCircle2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

const PROCEDURE_TYPES = [
  'CHEST_XRAY', 'MRI_BRAIN', 'MRI_SPINE', 'CT_ABDOMEN',
  'CT_CHEST', 'ULTRASOUND', 'ECHO', 'MAMMOGRAPHY', 'OTHER',
]

function UploadModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [clinicId, setClinicId] = useState('')
  const [procedureType, setProcedureType] = useState('')
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((files: File[]) => {
    const f = files[0]
    if (f) { setFile(f); if (!name) setName(f.name.replace(/\.docx$/i, '')) }
  }, [name])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    maxFiles: 1,
  })

  const handleSubmit = async () => {
    if (!file || !name.trim()) { toast.error('File and name are required'); return }
    setUploading(true)
    try {
      await uploadTemplate(file, name, clinicId || undefined, procedureType || undefined)
      toast.success('Template uploaded!')
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      onClose()
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Upload Template</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              isDragActive ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300',
              file && 'border-green-400 bg-green-50',
            )}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <span className="text-sm font-medium text-slate-700">{file.name}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Upload className="w-8 h-8 text-slate-300" />
                <span className="text-sm">Drop .docx template here or <span className="text-brand-600">browse</span></span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Chest X-Ray Report v2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Procedure Type</label>
            <select value={procedureType} onChange={e => setProcedureType(e.target.value)} className="input">
              <option value="">— Select —</option>
              {PROCEDURE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Clinic ID (optional)</label>
            <input value={clinicId} onChange={e => setClinicId(e.target.value)} className="input" placeholder="clinic-001" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={uploading || !file || !name} className="btn-primary">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Template
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ template, onDelete }: { template: Template; onDelete: (id: string) => void }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{template.name}</div>
            <div className="flex items-center gap-2 mt-1">
              {template.procedureType && (
                <span className="badge bg-purple-100 text-purple-700">
                  <Tag className="w-2.5 h-2.5" />
                  {template.procedureType}
                </span>
              )}
              <span className="badge bg-slate-100 text-slate-600">v{template.version}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onDelete(template.id)}
          className="text-slate-400 hover:text-red-500 transition-colors p-1 shrink-0"
          title="Delete template"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
        </span>
        {template.clinicId && <span>Clinic: {template.clinicId}</span>}
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const queryClient = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this template?')) return
    try {
      await deleteTemplate(id)
      toast.success('Template deactivated')
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    } catch {
      toast.error('Failed to delete template')
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Word (.docx) templates for each clinic and procedure type
          </p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Upload Template
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : templates.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <FileText className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="font-semibold text-slate-700 mb-2">No templates yet</h3>
          <p className="text-sm text-slate-500 mb-4 max-w-sm">
            Upload Word templates for each clinic/procedure type. Use <code className="bg-slate-100 px-1 rounded">{'{{PATIENT_NAME}}'}</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">{'{{REPORT_BODY}}'}</code> as placeholders.
          </p>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Upload first template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {templates.map(t => (
            <TemplateCard key={t.id} template={t} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  )
}
