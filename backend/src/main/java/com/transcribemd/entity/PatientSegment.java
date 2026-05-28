package com.transcribemd.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "patient_segments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientSegment {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @Column(name = "sequence_index", nullable = false)
    @Builder.Default
    private int sequenceIndex = 0;

    @Column(name = "audio_start_sec")
    private BigDecimal audioStartSec;

    @Column(name = "audio_end_sec")
    private BigDecimal audioEndSec;

    @Column(name = "extracted_patient_name")
    private String extractedPatientName;

    @Column(name = "extracted_mrn")
    private String extractedMrn;

    @Column(name = "extracted_dob")
    private String extractedDob;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id")
    private Template template;

    @Column(name = "template_match_confidence")
    private BigDecimal templateMatchConfidence;

    @Column(name = "boundary_confidence")
    private BigDecimal boundaryConfidence;

    @Column(name = "raw_transcript", columnDefinition = "TEXT")
    private String rawTranscript;

    @Column(name = "annotated_json", columnDefinition = "TEXT")
    private String annotatedJson;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SegmentStatus status = SegmentStatus.PROCESSING;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "segment", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<GeneratedDocument> documents = new ArrayList<>();

    @OneToMany(mappedBy = "segment", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<QAFlag> qaFlags = new ArrayList<>();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public enum SegmentStatus {
        PROCESSING,
        ASSEMBLED,
        QA_FLAGGED,
        NEEDS_REVIEW,
        APPROVED,
        REJECTED
    }
}
