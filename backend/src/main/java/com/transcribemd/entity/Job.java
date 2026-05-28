package com.transcribemd.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "jobs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Job {

    @Id
    private String id;

    @Column(name = "user_id")
    private String userId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private JobStatus status = JobStatus.UPLOADED;

    @Column(name = "audio_original_key", nullable = false)
    private String audioOriginalKey;

    @Column(name = "audio_file_name")
    private String audioFileName;

    @Column(name = "duration_seconds")
    private BigDecimal durationSeconds;

    @Column(name = "expected_clinic_id")
    private String expectedClinicId;

    @Column(name = "upload_meta", columnDefinition = "TEXT")
    private String uploadMeta;

    @Column(name = "error_details", columnDefinition = "TEXT")
    private String errorDetails;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "job", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<PatientSegment> segments = new ArrayList<>();

    @OneToMany(mappedBy = "job", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Image> images = new ArrayList<>();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public enum JobStatus {
        UPLOADED,
        DENOISING,
        TRANSCRIBING,
        SEGMENTING,
        ANNOTATING,
        ASSEMBLING,
        QA_REVIEW,
        READY_FOR_REVIEW,
        REVIEWED,
        EXPORTED,
        FAILED
    }
}
