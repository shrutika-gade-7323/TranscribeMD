package com.transcribemd.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "templates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Template {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "clinic_id")
    private String clinicId;

    @Column(name = "procedure_type")
    private String procedureType;

    @Column(name = "file_key", nullable = false)
    private String fileKey;

    @Column(name = "placeholder_schema", columnDefinition = "TEXT")
    private String placeholderSchema;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(nullable = false)
    @Builder.Default
    private int version = 1;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
