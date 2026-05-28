package com.transcribemd.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "images")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Image {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @Column(name = "file_key", nullable = false)
    private String fileKey;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "sequence_number", nullable = false)
    @Builder.Default
    private int sequenceNumber = 1;

    @Column(name = "vision_description", columnDefinition = "TEXT")
    private String visionDescription;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
