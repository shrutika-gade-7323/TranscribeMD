import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { createJob } from '../services/api'
import {
  Upload, Mic, Image as ImageIcon, X, FileAudio,
  CheckCircle2, Loader2, ChevronRight, Info
} from 'lucide-react'
import clsx from 'clsx'

type Step = 1 | 2 | 3

export default function UploadPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [clinicId, setClinicId] = useState('')
  const [uploading, setUploading] = useState(false)

  // Audio dropzone
  const onAudioDrop = useCallback((files: File[]) => {
    if (files[0]) setAudioFile(files[0])
  }, [])

  const { getRootProps: getAudioProps, getInputProps: getAudioInput, isDragActive: isAudioDrag } = useDropzone({
    onDrop: onAudioDrop,
    accept: { 'audio/*': ['.wav', '.mp3', '.mp4', '.m4a', '.ogg', '.flac', '.webm'] },
    maxFiles: 1,
  })

  // Image dropzone
  const onImageDrop = useCallback((files: File[]) => {
    setImageFiles(prev => [...prev, ...files])
  }, [])

  const { getRootProps: getImageProps, getInputProps: getImageInput, isDragActive: isImageDrag } = useDropzone({
    onDrop: onImageDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp'] },
  })

  const removeImage = (idx: number) =>
    setImageFiles(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    if (!audioFile) { toast.error('Please upload an audio file'); return }
    setUploading(true)
    try {
      const job = await createJob(audioFile, imageFiles, clinicId || undefined)
      toast.success('Job created — processing has started!')
      navigate(`/jobs/${job.id}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed. Is the backend running?')
    } finally {
      setUploading(false)
    }
  }

  const steps = [
    { num: 1, label: 'Audio File' },
    { num: 2, label: 'Images' },
    { num: 3, label: 'Context' },
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New Transcription Job</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload your audio dictation, optional X-ray/report images, and job context.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <button
              onClick={() => step > s.num && setStep(s.num as Step)}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                step === s.num
                  ? 'bg-brand-600 text-white'
                  : step > s.num
                  ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200'
                  : 'bg-slate-100 text-slate-500'
              )}
            >
              {step > s.num
                ? <CheckCircle2 className="w-4 h-4" />
                : <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-xs">{s.num}</span>
              }
              {s.label}
            </button>
            {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step 1: Audio */}
      {step === 1 && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Mic className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Audio Dictation</h2>
              <p className="text-xs text-slate-500">WAV, MP3, MP4, M4A, FLAC — up to 500MB</p>
            </div>
          </div>

          <div
            {...getAudioProps()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
              isAudioDrag ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50',
              audioFile && 'border-green-400 bg-green-50'
            )}
          >
            <input {...getAudioInput()} />
            {audioFile ? (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <div>
                  <p className="font-medium text-slate-900">{audioFile.name}</p>
                  <p className="text-sm text-slate-500">{(audioFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setAudioFile(null) }}
                  className="btn-secondary text-xs"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Upload className="w-10 h-10 text-slate-300" />
                <div>
                  <p className="font-medium">Drop audio file here or <span className="text-brand-600">browse</span></p>
                  <p className="text-sm">Supports WAV, MP3, MP4, M4A, FLAC</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 mt-4 p-3 bg-blue-50 rounded-lg">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              The AI will automatically transcribe the audio, detect patient boundaries for multi-patient
              recordings, and apply formatting instructions dictated by the doctor.
            </p>
          </div>

          <div className="flex justify-end mt-5">
            <button
              onClick={() => { if (audioFile) setStep(2) }}
              disabled={!audioFile}
              className="btn-primary"
            >
              Next: Images <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Images */}
      {step === 2 && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">X-rays & Report Images</h2>
              <p className="text-xs text-slate-500">Optional — PNG, JPG, TIFF. Numbered in order.</p>
            </div>
          </div>

          <div
            {...getImageProps()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4',
              isImageDrag ? 'border-purple-400 bg-purple-50' : 'border-slate-200 hover:border-purple-300'
            )}
          >
            <input {...getImageInput()} />
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600">
              Drop images here or <span className="text-purple-600 font-medium">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">They'll be numbered in the order you upload them (Image 1, 2, 3…)</p>
          </div>

          {imageFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {imageFiles.map((file, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-24 object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                    #{idx + 1}
                  </div>
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="px-2 py-1 text-xs text-slate-600 truncate">{file.name}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-5">
            <button onClick={() => setStep(1)} className="btn-secondary">Back</button>
            <button onClick={() => setStep(3)} className="btn-primary">
              Next: Context <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Context */}
      {step === 3 && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <FileAudio className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Job Context</h2>
              <p className="text-xs text-slate-500">Optional hints to improve template selection</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Clinic ID (optional)</label>
              <input
                type="text"
                value={clinicId}
                onChange={e => setClinicId(e.target.value)}
                placeholder="e.g. clinic-001"
                className="input"
              />
              <p className="text-xs text-slate-400 mt-1">Used to narrow down template selection</p>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-slate-50 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Job Summary</p>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <FileAudio className="w-4 h-4 text-brand-600" />
              <span className="font-medium">{audioFile?.name}</span>
              <span className="text-slate-400">({(audioFile!.size / 1024 / 1024).toFixed(1)} MB)</span>
            </div>
            {imageFiles.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <ImageIcon className="w-4 h-4 text-purple-600" />
                <span>{imageFiles.length} image(s) uploaded</span>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(2)} className="btn-secondary">Back</button>
            <button
              onClick={handleSubmit}
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="w-4 h-4" /> Submit Job</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
