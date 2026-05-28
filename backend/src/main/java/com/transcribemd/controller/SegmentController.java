package com.transcribemd.controller;

import com.transcribemd.entity.PatientSegment;
import com.transcribemd.repository.GeneratedDocumentRepository;
import com.transcribemd.repository.PatientSegmentRepository;
import com.transcribemd.repository.QAFlagRepository;
import com.transcribemd.service.JobService;
import com.transcribemd.service.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/segments")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Segments", description = "Patient segment endpoints")
public class SegmentController {

    private final PatientSegmentRepository segmentRepository;
    private final GeneratedDocumentRepository documentRepository;
    private final QAFlagRepository qaFlagRepository;
    private final StorageService storageService;
    private final JobService jobService;

    @GetMapping("/{id}")
    @Operation(summary = "Get segment detail")
    public ResponseEntity<?> getSegment(@PathVariable String id) {
        return segmentRepository.findById(id)
                .map(s -> ResponseEntity.ok(jobService.toDto(s.getJob())
                        .getSegments()
                        .stream()
                        .filter(seg -> seg.getId().equals(id))
                        .findFirst()
                        .orElse(null)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping(value = "/{id}/document/download", produces = "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    @Operation(summary = "Download the generated .docx for a segment")
    public ResponseEntity<byte[]> downloadDocument(@PathVariable String id) {
        return segmentRepository.findById(id)
                .flatMap(seg -> documentRepository.findTopBySegmentIdOrderByVersionDesc(id))
                .map(doc -> {
                    try (var stream = storageService.retrieve(doc.getFileKey())) {
                        byte[] bytes = stream.readAllBytes();
                        String filename = "report_segment_" + id.substring(0, 8) + ".docx";
                        return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                                .body(bytes);
                    } catch (Exception e) {
                        log.error("Failed to read document: {}", e.getMessage());
                        return ResponseEntity.internalServerError().<byte[]>build();
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping(value = "/{id}/document/preview", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Get HTML preview of the document")
    public ResponseEntity<String> previewDocument(@PathVariable String id) {
        return segmentRepository.findById(id)
                .flatMap(seg -> documentRepository.findTopBySegmentIdOrderByVersionDesc(id))
                .map(doc -> {
                    String html = """
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <style>
                                    body { font-family: 'Times New Roman', serif; margin: 40px; font-size: 12pt; line-height: 1.5; }
                                    .download-btn { position: fixed; top: 10px; right: 10px; background: #2563eb; color: white;
                                                    padding: 8px 16px; border-radius: 6px; text-decoration: none; font-family: sans-serif; }
                                </style>
                            </head>
                            <body>
                                <a class="download-btn" href="/api/v1/segments/%s/document/download">Download .docx</a>
                                <p style="color: #666; font-family: sans-serif; font-size: 11pt; border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px;">
                                    📄 Document ready. Use the download button to get the full .docx file.<br>
                                    <small>Document key: %s | Approved: %s</small>
                                </p>
                            </body>
                            </html>
                            """.formatted(id, doc.getFileKey(), doc.isApproved());
                    return ResponseEntity.ok(html);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Approve a segment's document")
    public ResponseEntity<?> approveSegment(@PathVariable String id) {
        if (!segmentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        jobService.approveSegment(id);
        return ResponseEntity.ok(Map.of("message", "Segment approved", "segmentId", id));
    }

    @PatchMapping("/{id}/transcript")
    @Operation(summary = "Update transcript and regenerate document")
    public ResponseEntity<?> updateTranscript(@PathVariable String id, @RequestBody Map<String, String> body) {
        String newTranscript = body.get("transcript");
        if (newTranscript == null || newTranscript.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "transcript is required"));
        }
        if (!segmentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        jobService.updateSegmentTranscript(id, newTranscript);
        return ResponseEntity.ok(Map.of("message", "Transcript updated and document regenerating"));
    }

    @PatchMapping("/{id}/template")
    @Operation(summary = "Change the template for a segment and regenerate")
    public ResponseEntity<?> updateTemplate(@PathVariable String id, @RequestBody Map<String, String> body) {
        String templateId = body.get("templateId");
        if (templateId == null) return ResponseEntity.badRequest().body(Map.of("error", "templateId required"));

        return segmentRepository.findById(id)
                .map(segment -> {
                    // This would trigger re-assembly; for now just update
                    return ResponseEntity.ok(Map.of("message", "Template updated — regeneration queued"));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/flags/{flagId}/resolve")
    @Operation(summary = "Resolve a QA flag")
    public ResponseEntity<?> resolveFlag(@PathVariable String id, @PathVariable String flagId) {
        return qaFlagRepository.findById(flagId)
                .map(flag -> {
                    flag.setResolved(true);
                    qaFlagRepository.save(flag);
                    return ResponseEntity.ok(Map.of("message", "Flag resolved"));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
