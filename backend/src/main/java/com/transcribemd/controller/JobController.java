package com.transcribemd.controller;

import com.transcribemd.dto.CreateJobRequest;
import com.transcribemd.dto.JobDto;
import com.transcribemd.entity.Job;
import com.transcribemd.service.JobService;
import com.transcribemd.service.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Jobs", description = "Job management endpoints")
public class JobController {

    private final JobService jobService;
    private final StorageService storageService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Create a new transcription job")
    public ResponseEntity<JobDto> createJob(
            @RequestPart("audio") MultipartFile audio,
            @RequestPart(value = "images", required = false) List<MultipartFile> images,
            @RequestPart(value = "clinicId", required = false) String clinicId,
            @RequestPart(value = "expectedPatients", required = false) String expectedPatientsJson
    ) {
        CreateJobRequest meta = new CreateJobRequest();
        meta.setExpectedClinicId(clinicId);

        Job job = jobService.createJob(audio, images, meta);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(jobService.toDto(job));
    }

    @GetMapping
    @Operation(summary = "List all jobs")
    public ResponseEntity<List<JobDto>> listJobs() {
        List<JobDto> jobs = jobService.getAllJobs()
                .stream()
                .map(jobService::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(jobs);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get job detail")
    public ResponseEntity<JobDto> getJob(@PathVariable String id) {
        return jobService.getJobById(id)
                .map(job -> ResponseEntity.ok(jobService.toDto(job)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/status")
    @Operation(summary = "Get job status (lightweight)")
    public ResponseEntity<?> getJobStatus(@PathVariable String id) {
        return jobService.getJobById(id)
                .map(job -> ResponseEntity.ok(java.util.Map.of(
                        "id", job.getId(),
                        "status", job.getStatus().name(),
                        "updatedAt", job.getUpdatedAt() != null ? job.getUpdatedAt().toString() : ""
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping(value = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "SSE stream of job status events")
    public SseEmitter streamJobEvents(@PathVariable String id) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5 min timeout
        jobService.addSseEmitter(id, emitter);
        emitter.onCompletion(() -> log.debug("SSE completed for job {}", id));
        emitter.onTimeout(() -> log.debug("SSE timeout for job {}", id));
        return emitter;
    }

    @PostMapping("/{id}/reprocess")
    @Operation(summary = "Reprocess a failed job")
    public ResponseEntity<?> reprocessJob(@PathVariable String id) {
        return jobService.getJobById(id)
                .map(job -> {
                    jobService.processJobAsync(id);
                    return ResponseEntity.ok(java.util.Map.of("message", "Reprocessing started"));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
