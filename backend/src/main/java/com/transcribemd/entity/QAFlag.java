package com.transcribemd.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "qa_flags")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QAFlag {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_segment_id", nullable = false)
    private PatientSegment segment;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Severity severity = Severity.INFO;

    @Column
    private String category;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(nullable = false)
    @Builder.Default
    private boolean resolved = false;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum Severity {
        INFO, WARNING, ERROR
    }
}
