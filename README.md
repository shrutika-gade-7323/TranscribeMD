# TranscribeMD

AI-powered medical transcription system that converts doctor audio dictations into fully formatted Word documents.

## Quick Start

### Prerequisites
- Java 17, Maven 3.9+
- Node.js 18+, npm
- Python 3.9+
- Docker Desktop (for PostgreSQL + MinIO in production)

### 1. Set up environment
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 2. Start backend (dev mode — uses H2 in-memory DB)
```bash
cd backend
mvn spring-boot:run
# API at http://localhost:8080
# Swagger UI at http://localhost:8080/swagger-ui.html
# H2 Console at http://localhost:8080/h2-console
```

### 3. Start ML service
```bash
cd ml-service
pip install -r requirements.txt
# On first run, Whisper downloads ~140MB model
python main.py
# Service at http://localhost:8000
```

### 4. Start frontend
```bash
cd frontend
npm install
npm run dev
# App at http://localhost:5173
```

### 5. Full stack with Docker (production-like)
```bash
docker compose up --build
# App at http://localhost:5173 (frontend served separately or via Vite proxy)
# Backend at http://localhost:8080
# MinIO console at http://localhost:9001 (minioadmin / minioadmin123)
```

## Architecture

```
frontend (React + TS, port 5173)
    ↓ proxy /api → 
backend (Spring Boot, port 8080)
    ↓ HTTP →
ml-service (FastAPI + Whisper, port 8000)

Storage:
  Dev: H2 in-memory DB + local ./uploads/ folder
  Prod: PostgreSQL + MinIO (via Docker Compose)
```

## Project Structure

```
├── backend/               Spring Boot 3.2 (Java 17)
│   ├── entity/            JPA entities
│   ├── service/           Business logic
│   │   ├── JobService     Job lifecycle + async pipeline
│   │   ├── AnnotationService  Calls Claude API
│   │   ├── DocumentAssemblerService  Apache POI .docx
│   │   ├── AudioService   Calls Python ML service
│   │   └── StorageService Local / MinIO
│   └── controller/        REST API
├── frontend/              React 18 + TypeScript + Tailwind
│   ├── pages/
│   │   ├── DashboardPage  Job queue with live status
│   │   ├── UploadPage     3-step wizard
│   │   ├── JobPage        Pipeline progress + segments
│   │   ├── ReviewPage     3-pane: audio / doc / controls
│   │   └── TemplatesPage  Template management
│   └── services/api.ts    Axios API client
└── ml-service/            FastAPI + Whisper
    ├── main.py            Routes
    └── services/
        ├── whisper_service.py   ASR
        └── boundary_service.py  Patient boundary detection
```

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/jobs` | POST | Create job (audio + images) |
| `/api/v1/jobs` | GET | List all jobs |
| `/api/v1/jobs/{id}` | GET | Job detail + segments |
| `/api/v1/jobs/{id}/events` | GET (SSE) | Live status stream |
| `/api/v1/segments/{id}/document/download` | GET | Download .docx |
| `/api/v1/segments/{id}/approve` | POST | Approve segment |
| `/api/v1/templates` | POST | Upload Word template |
| `/api/v1/templates` | GET | List templates |

Full OpenAPI docs: `http://localhost:8080/swagger-ui.html`

## Word Template Format

Templates are `.docx` files with these placeholders:
- `{{PATIENT_NAME}}` — replaced with extracted patient name
- `{{PATIENT_MRN}}` — replaced with MRN
- `{{PATIENT_DOB}}` — replaced with date of birth
- `{{REPORT_BODY}}` — replaced with AI-generated structured content

## Whisper Model Sizes

| Model | Size | Speed | Accuracy |
|---|---|---|---|
| `base` | ~140MB | Fast | Good |
| `small` | ~460MB | Medium | Better |
| `medium` | ~1.5GB | Slow | Best (recommended) |
| `large-v3` | ~3GB | Slowest | Highest |

Set `WHISPER_MODEL=medium` in `.env` for production quality.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for annotation |
| `WHISPER_MODEL` | No | Whisper model size (default: `base`) |
| `STORAGE_TYPE` | No | `local` or `minio` (default: `local`) |
| `ML_SERVICE_URL` | No | Python service URL (default: `http://localhost:8000`) |
