package com.transcribemd.service;

import com.transcribemd.dto.CreateJobRequest;
import com.transcribemd.dto.JobDto;
import com.transcribemd.entity.*;
import com.transcribemd.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class JobService {

    private final JobRepository jobRepository;
    private final PatientSegmentRepository segmentRepository;
    private final GeneratedDocumentRepository documentRepository;
    private final QAFlagRepository qaFlagRepository;
    private final ImageRepository imageRepository;
    private final StorageService storageService;
    private final AudioService audioService;
    private final AnnotationService annotationService;
    private final DocumentAssemblerService assemblerService;
    private final TemplateService templateService;

    // SSE emitters for live status updates
    private final Map<String, List<org.springframework.web.servlet.mvc.method.annotation.SseEmitter>> emitters = new java.util.concurrent.ConcurrentHashMap<>();

    @Transactional
    public Job createJob(MultipartFile audioFile, List<MultipartFile> imageFiles, CreateJobRequest meta) {
        String jobId = UUID.randomUUID().toString();
        String audioKey = "jobs/" + jobId + "/audio/" + audioFile.getOriginalFilename();
        storageService.store(audioFile, audioKey);

        Job job = Job.builder()
                .id(jobId)
                .audioOriginalKey(audioKey)
                .audioFileName(audioFile.getOriginalFilename())
                .expectedClinicId(meta != null ? meta.getExpectedClinicId() : null)
                .status(Job.JobStatus.UPLOADED)
                .build();
        job = jobRepository.save(job);

        // Store images
        if (imageFiles != null && !imageFiles.isEmpty()) {
            int seq = 1;
            for (MultipartFile imgFile : imageFiles) {
                String imgKey = "jobs/" + jobId + "/images/" + imgFile.getOriginalFilename();
                storageService.store(imgFile, imgKey);
                Image img = Image.builder()
                        .id(UUID.randomUUID().toString())
                        .job(job)
                        .fileKey(imgKey)
                        .fileName(imgFile.getOriginalFilename())
                        .sequenceNumber(seq++)
                        .mimeType(imgFile.getContentType())
                        .build();
                imageRepository.save(img);
            }
        }

        log.info("Job created: {}", jobId);
        processJobAsync(jobId);
        return job;
    }

    @Async
    public void processJobAsync(String jobId) {
        try {
            log.info("Starting async processing for job: {}", jobId);

            // 1. Transcribe
            updateJobStatus(jobId, Job.JobStatus.TRANSCRIBING);
            Job job = getJobOrThrow(jobId);

            AudioService.TranscriptionResult transcription;
            try (var audioStream = storageService.retrieve(job.getAudioOriginalKey())) {
                transcription = audioService.transcribe(audioStream, job.getAudioFileName());
            }

            if (transcription.getDurationSeconds() > 0) {
                job.setDurationSeconds(BigDecimal.valueOf(transcription.getDurationSeconds()));
            }
            jobRepository.save(job);
            emitStatusUpdate(jobId, Job.JobStatus.TRANSCRIBING.name(), "Transcription complete (" + transcription.getTranscript().length() + " chars)");

            // 2. Detect patient boundaries
            updateJobStatus(jobId, Job.JobStatus.SEGMENTING);
            List<AudioService.PatientBoundary> boundaries = audioService.detectPatientBoundaries(transcription.getTranscript());
            emitStatusUpdate(jobId, Job.JobStatus.SEGMENTING.name(), "Detected " + (boundaries.size() + 1) + " patient segment(s)");

            // 3. Split into segments
            List<String> segmentTranscripts = splitTranscript(transcription.getTranscript(), boundaries);
            List<Image> jobImages = imageRepository.findByJobIdOrderBySequenceNumber(jobId);

            // 4. Process each segment
            updateJobStatus(jobId, Job.JobStatus.ANNOTATING);
            List<PatientSegment> segments = new ArrayList<>();
            for (int i = 0; i < segmentTranscripts.size(); i++) {
                String segText = segmentTranscripts.get(i);
                AudioService.PatientBoundary boundary = (boundaries.size() > i) ? boundaries.get(i) : null;

                PatientSegment segment = PatientSegment.builder()
                        .id(UUID.randomUUID().toString())
                        .job(job)
                        .sequenceIndex(i)
                        .rawTranscript(segText)
                        .extractedPatientName(boundary != null ? boundary.getExtractedPatientName() : null)
                        .extractedMrn(boundary != null ? boundary.getExtractedMrn() : null)
                        .boundaryConfidence(boundary != null ? BigDecimal.valueOf(boundary.getConfidence()) : BigDecimal.ONE)
                        .status(PatientSegment.SegmentStatus.PROCESSING)
                        .build();
                segments.add(segmentRepository.save(segment));
            }

            // 5. Annotate and assemble each segment
            updateJobStatus(jobId, Job.JobStatus.ASSEMBLING);
            for (PatientSegment segment : segments) {
                processSegment(segment, jobImages);
                emitStatusUpdate(jobId, Job.JobStatus.ASSEMBLING.name(), "Assembled segment " + (segment.getSequenceIndex() + 1));
            }

            updateJobStatus(jobId, Job.JobStatus.READY_FOR_REVIEW);
            emitStatusUpdate(jobId, Job.JobStatus.READY_FOR_REVIEW.name(), "Ready for review — " + segments.size() + " document(s) generated");
            log.info("Job {} processing complete", jobId);

        } catch (Exception e) {
            log.error("Job {} processing failed: {}", jobId, e.getMessage(), e);
            Job job = jobRepository.findById(jobId).orElse(null);
            if (job != null) {
                job.setStatus(Job.JobStatus.FAILED);
                job.setErrorDetails(e.getMessage());
                jobRepository.save(job);
            }
            emitStatusUpdate(jobId, Job.JobStatus.FAILED.name(), "Processing failed: " + e.getMessage());
        }
    }

    @Transactional
    public void processSegment(PatientSegment segment, List<Image> images) {
        try {
            // Annotate
            AnnotationService.AnnotatedTranscript annotation = annotationService.annotate(segment.getRawTranscript());
            segment.setAnnotatedJson(annotation.json());

            // Select template
            Template template = templateService.selectTemplateForTranscript(
                    segment.getRawTranscript(),
                    segment.getJob().getExpectedClinicId()
            );
            if (template != null) {
                segment.setTemplate(template);
                segment.setTemplateMatchConfidence(BigDecimal.valueOf(0.8));
            }

            // Extract patient info from annotation if not already set
            if (segment.getExtractedPatientName() == null) {
                extractPatientInfoFromAnnotation(segment, annotation.json());
            }

            segment.setStatus(PatientSegment.SegmentStatus.ASSEMBLED);
            segmentRepository.save(segment);

            // Assemble document
            String templateKey = template != null ? template.getFileKey() : null;
            byte[] docBytes = assemblerService.assemble(annotation.json(), templateKey, images);

            String docKey = "jobs/" + segment.getJob().getId() + "/output/segment_" + segment.getSequenceIndex() + ".docx";
            storageService.store(docBytes, docKey, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

            GeneratedDocument doc = GeneratedDocument.builder()
                    .id(UUID.randomUUID().toString())
                    .segment(segment)
                    .fileKey(docKey)
                    .build();
            documentRepository.save(doc);

            // Run basic QA
            runQAChecks(segment, annotation.json());

        } catch (Exception e) {
            log.error("Segment {} processing failed: {}", segment.getId(), e.getMessage(), e);
            segment.setStatus(PatientSegment.SegmentStatus.NEEDS_REVIEW);
            QAFlag flag = QAFlag.builder()
                    .id(UUID.randomUUID().toString())
                    .segment(segment)
                    .severity(QAFlag.Severity.ERROR)
                    .category("PROCESSING_ERROR")
                    .message("Failed to generate document: " + e.getMessage())
                    .build();
            qaFlagRepository.save(flag);
            segmentRepository.save(segment);
        }
    }

    public List<Job> getAllJobs() {
        return jobRepository.findAllByOrderByCreatedAtDesc();
    }

    public Optional<Job> getJobById(String id) {
        return jobRepository.findById(id);
    }

    public JobDto toDto(Job job) {
        List<PatientSegment> segments = segmentRepository.findByJobIdOrderBySequenceIndex(job.getId());
        List<Image> images = imageRepository.findByJobIdOrderBySequenceNumber(job.getId());

        long approved = segments.stream().filter(s -> s.getStatus() == PatientSegment.SegmentStatus.APPROVED).count();

        return JobDto.builder()
                .id(job.getId())
                .status(job.getStatus())
                .audioFileName(job.getAudioFileName())
                .durationSeconds(job.getDurationSeconds())
                .expectedClinicId(job.getExpectedClinicId())
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .errorDetails(job.getErrorDetails())
                .totalSegments(segments.size())
                .approvedSegments((int) approved)
                .segments(segments.stream().map(this::toSegmentDto).collect(Collectors.toList()))
                .images(images.stream().map(this::toImageDto).collect(Collectors.toList()))
                .build();
    }

    private JobDto.SegmentSummaryDto toSegmentDto(PatientSegment s) {
        Optional<GeneratedDocument> doc = documentRepository.findTopBySegmentIdOrderByVersionDesc(s.getId());
        List<QAFlag> flags = qaFlagRepository.findBySegmentIdOrderByCreatedAtDesc(s.getId());
        long unresolved = flags.stream().filter(f -> !f.isResolved()).count();

        JobDto.TemplateDto templateDto = null;
        if (s.getTemplate() != null) {
            templateDto = JobDto.TemplateDto.builder()
                    .id(s.getTemplate().getId())
                    .name(s.getTemplate().getName())
                    .procedureType(s.getTemplate().getProcedureType())
                    .clinicId(s.getTemplate().getClinicId())
                    .build();
        }

        JobDto.DocumentDto docDto = null;
        if (doc.isPresent()) {
            GeneratedDocument d = doc.get();
            docDto = JobDto.DocumentDto.builder()
                    .id(d.getId())
                    .downloadUrl("/api/v1/segments/" + s.getId() + "/document/download")
                    .previewUrl("/api/v1/segments/" + s.getId() + "/document/preview")
                    .version(d.getVersion())
                    .approved(d.isApproved())
                    .approvedAt(d.getApprovedAt())
                    .build();
        }

        return JobDto.SegmentSummaryDto.builder()
                .id(s.getId())
                .sequenceIndex(s.getSequenceIndex())
                .audioStartSec(s.getAudioStartSec())
                .audioEndSec(s.getAudioEndSec())
                .extractedPatientName(s.getExtractedPatientName())
                .extractedMrn(s.getExtractedMrn())
                .extractedDob(s.getExtractedDob())
                .template(templateDto)
                .templateMatchConfidence(s.getTemplateMatchConfidence())
                .boundaryConfidence(s.getBoundaryConfidence())
                .rawTranscript(s.getRawTranscript())
                .annotatedJson(s.getAnnotatedJson())
                .status(s.getStatus())
                .document(docDto)
                .qaFlags(flags.stream().map(f -> JobDto.QAFlagDto.builder()
                        .id(f.getId())
                        .severity(f.getSeverity())
                        .category(f.getCategory())
                        .message(f.getMessage())
                        .resolved(f.isResolved())
                        .build()).collect(Collectors.toList()))
                .unresolvedFlagCount((int) unresolved)
                .build();
    }

    private JobDto.ImageDto toImageDto(Image img) {
        return JobDto.ImageDto.builder()
                .id(img.getId())
                .fileName(img.getFileName())
                .sequenceNumber(img.getSequenceNumber())
                .visionDescription(img.getVisionDescription())
                .url("/api/v1/images/" + img.getId())
                .build();
    }

    @Transactional
    public void approveSegment(String segmentId) {
        segmentRepository.findById(segmentId).ifPresent(segment -> {
            segment.setStatus(PatientSegment.SegmentStatus.APPROVED);
            segmentRepository.save(segment);

            documentRepository.findTopBySegmentIdOrderByVersionDesc(segmentId).ifPresent(doc -> {
                doc.setApproved(true);
                doc.setApprovedAt(java.time.LocalDateTime.now());
                documentRepository.save(doc);
            });

            // Check if all segments of the job are approved
            Job job = segment.getJob();
            List<PatientSegment> allSegments = segmentRepository.findByJobIdOrderBySequenceIndex(job.getId());
            boolean allApproved = allSegments.stream().allMatch(s -> s.getStatus() == PatientSegment.SegmentStatus.APPROVED);
            if (allApproved) {
                job.setStatus(Job.JobStatus.REVIEWED);
                jobRepository.save(job);
            }
        });
    }

    @Transactional
    public void updateSegmentTranscript(String segmentId, String newTranscript) {
        segmentRepository.findById(segmentId).ifPresent(segment -> {
            segment.setRawTranscript(newTranscript);
            segment.setStatus(PatientSegment.SegmentStatus.PROCESSING);
            segmentRepository.save(segment);

            // Re-process
            List<Image> images = imageRepository.findByJobIdOrderBySequenceNumber(segment.getJob().getId());
            processSegment(segment, images);
        });
    }

    public void addSseEmitter(String jobId, org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter) {
        emitters.computeIfAbsent(jobId, k -> new java.util.concurrent.CopyOnWriteArrayList<>()).add(emitter);
    }

    private void emitStatusUpdate(String jobId, String status, String message) {
        List<org.springframework.web.servlet.mvc.method.annotation.SseEmitter> jobEmitters = emitters.get(jobId);
        if (jobEmitters == null || jobEmitters.isEmpty()) return;

        String data = "{\"status\":\"" + status + "\",\"message\":\"" + message.replace("\"", "'") + "\",\"timestamp\":\"" + java.time.Instant.now() + "\"}";
        jobEmitters.removeIf(emitter -> {
            try {
                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().data(data));
                return false;
            } catch (Exception e) {
                return true;
            }
        });
    }

    private void updateJobStatus(String jobId, Job.JobStatus status) {
        jobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus(status);
            jobRepository.save(job);
        });
    }

    private Job getJobOrThrow(String jobId) {
        return jobRepository.findById(jobId)
                .orElseThrow(() -> new RuntimeException("Job not found: " + jobId));
    }

    private List<String> splitTranscript(String transcript, List<AudioService.PatientBoundary> boundaries) {
        if (boundaries == null || boundaries.isEmpty()) {
            return List.of(transcript);
        }
        List<String> segments = new ArrayList<>();
        int lastIndex = 0;
        for (AudioService.PatientBoundary boundary : boundaries) {
            int idx = Math.min(boundary.getCharacterIndex(), transcript.length());
            if (idx > lastIndex) {
                segments.add(transcript.substring(lastIndex, idx).trim());
                lastIndex = idx;
            }
        }
        segments.add(transcript.substring(lastIndex).trim());
        return segments.stream().filter(s -> !s.isEmpty()).collect(Collectors.toList());
    }

    private void extractPatientInfoFromAnnotation(PatientSegment segment, String annotatedJson) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode root = om.readTree(annotatedJson);
            com.fasterxml.jackson.databind.JsonNode patient = root.path("patient");
            if (!patient.isMissingNode()) {
                String name = patient.path("name").asText(null);
                String mrn = patient.path("mrn").asText(null);
                String dob = patient.path("dob").asText(null);
                if (name != null && !name.equals("null")) segment.setExtractedPatientName(name);
                if (mrn != null && !mrn.equals("null")) segment.setExtractedMrn(mrn);
                if (dob != null && !dob.equals("null")) segment.setExtractedDob(dob);
            }
        } catch (Exception e) {
            log.debug("Could not extract patient info from annotation: {}", e.getMessage());
        }
    }

    private void runQAChecks(PatientSegment segment, String annotatedJson) {
        List<QAFlag> flags = new ArrayList<>();

        // Check for missing patient identity
        if (segment.getExtractedPatientName() == null || segment.getExtractedPatientName().isEmpty()) {
            flags.add(buildFlag(segment, QAFlag.Severity.WARNING, "MISSING_PATIENT_ID", "No patient name detected in dictation"));
        }

        // Check for common required sections in radiology reports
        String transcript = segment.getRawTranscript().toLowerCase();
        if (transcript.contains("impression") && !annotatedJson.toLowerCase().contains("impression")) {
            flags.add(buildFlag(segment, QAFlag.Severity.WARNING, "MISSING_SECTION", "IMPRESSION mentioned in dictation but not captured as section"));
        }
        if (transcript.contains("findings") && !annotatedJson.toLowerCase().contains("findings")) {
            flags.add(buildFlag(segment, QAFlag.Severity.WARNING, "MISSING_SECTION", "FINDINGS mentioned in dictation but not captured as section"));
        }

        if (!flags.isEmpty()) {
            qaFlagRepository.saveAll(flags);
            segment.setStatus(PatientSegment.SegmentStatus.QA_FLAGGED);
            segmentRepository.save(segment);
        }
    }

    private QAFlag buildFlag(PatientSegment segment, QAFlag.Severity severity, String category, String message) {
        return QAFlag.builder()
                .id(UUID.randomUUID().toString())
                .segment(segment)
                .severity(severity)
                .category(category)
                .message(message)
                .build();
    }
}
