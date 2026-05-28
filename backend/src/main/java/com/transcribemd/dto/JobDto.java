package com.transcribemd.dto;

import com.transcribemd.entity.Job;
import com.transcribemd.entity.PatientSegment;
import com.transcribemd.entity.QAFlag;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class JobDto {
    private String id;
    private Job.JobStatus status;
    private String audioFileName;
    private BigDecimal durationSeconds;
    private String expectedClinicId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String errorDetails;
    private List<SegmentSummaryDto> segments;
    private List<ImageDto> images;
    private int totalSegments;
    private int approvedSegments;

    @Data
    @Builder
    public static class SegmentSummaryDto {
        private String id;
        private int sequenceIndex;
        private BigDecimal audioStartSec;
        private BigDecimal audioEndSec;
        private String extractedPatientName;
        private String extractedMrn;
        private String extractedDob;
        private TemplateDto template;
        private BigDecimal templateMatchConfidence;
        private BigDecimal boundaryConfidence;
        private String rawTranscript;
        private String annotatedJson;
        private PatientSegment.SegmentStatus status;
        private DocumentDto document;
        private List<QAFlagDto> qaFlags;
        private int unresolvedFlagCount;
    }

    @Data
    @Builder
    public static class DocumentDto {
        private String id;
        private String downloadUrl;
        private String previewUrl;
        private int version;
        private boolean approved;
        private LocalDateTime approvedAt;
    }

    @Data
    @Builder
    public static class QAFlagDto {
        private String id;
        private QAFlag.Severity severity;
        private String category;
        private String message;
        private boolean resolved;
    }

    @Data
    @Builder
    public static class ImageDto {
        private String id;
        private String fileName;
        private int sequenceNumber;
        private String visionDescription;
        private String url;
    }

    @Data
    @Builder
    public static class TemplateDto {
        private String id;
        private String name;
        private String procedureType;
        private String clinicId;
    }
}
