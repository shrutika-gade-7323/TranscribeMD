-- Users
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'TRANSCRIPTIONIST',
    organization VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Clinics
CREATE TABLE IF NOT EXISTS clinics (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    specialty VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    clinic_id VARCHAR(36) REFERENCES clinics(id),
    procedure_type VARCHAR(100),
    file_key VARCHAR(500) NOT NULL,
    placeholder_schema TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_template_clinic ON templates(clinic_id);
CREATE INDEX IF NOT EXISTS idx_template_procedure ON templates(procedure_type);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    status VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',
    audio_original_key VARCHAR(500) NOT NULL,
    audio_file_name VARCHAR(255),
    duration_seconds NUMERIC,
    expected_clinic_id VARCHAR(36) REFERENCES clinics(id),
    upload_meta TEXT,
    error_details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_created ON jobs(created_at);

-- Job Artifacts (intermediate files)
CREATE TABLE IF NOT EXISTS job_artifacts (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL,
    file_key VARCHAR(500),
    metadata TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artifact_job ON job_artifacts(job_id);

-- Images
CREATE TABLE IF NOT EXISTS images (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    file_key VARCHAR(500) NOT NULL,
    file_name VARCHAR(255),
    sequence_number INT NOT NULL DEFAULT 1,
    vision_description TEXT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_image_job ON images(job_id);

-- Patient Segments (one job can produce multiple segments)
CREATE TABLE IF NOT EXISTS patient_segments (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    sequence_index INT NOT NULL DEFAULT 0,
    audio_start_sec NUMERIC,
    audio_end_sec NUMERIC,
    extracted_patient_name VARCHAR(255),
    extracted_mrn VARCHAR(100),
    extracted_dob VARCHAR(50),
    template_id VARCHAR(36) REFERENCES templates(id),
    template_match_confidence NUMERIC,
    boundary_confidence NUMERIC,
    raw_transcript TEXT,
    annotated_json TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_segment_job ON patient_segments(job_id);

-- Generated Documents
CREATE TABLE IF NOT EXISTS generated_documents (
    id VARCHAR(36) PRIMARY KEY,
    patient_segment_id VARCHAR(36) NOT NULL REFERENCES patient_segments(id) ON DELETE CASCADE,
    file_key VARCHAR(500),
    version INT NOT NULL DEFAULT 1,
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_segment ON generated_documents(patient_segment_id);

-- Image Placements
CREATE TABLE IF NOT EXISTS image_placements (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) REFERENCES generated_documents(id) ON DELETE CASCADE,
    image_id VARCHAR(36) REFERENCES images(id),
    paragraph_index INT,
    caption TEXT,
    anchor_text TEXT
);

-- QA Flags
CREATE TABLE IF NOT EXISTS qa_flags (
    id VARCHAR(36) PRIMARY KEY,
    patient_segment_id VARCHAR(36) NOT NULL REFERENCES patient_segments(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    category VARCHAR(50),
    message TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flag_segment ON qa_flags(patient_segment_id);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(36),
    event_type VARCHAR(50) NOT NULL,
    event_details TEXT,
    actor VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_job ON audit_log(job_id);

-- Seed data is inserted by DataInitializer on startup
