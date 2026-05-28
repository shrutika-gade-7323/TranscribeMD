package com.transcribemd.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TemplateDto {
    private String id;
    private String name;
    private String clinicId;
    private String procedureType;
    private boolean active;
    private int version;
    private String placeholderSchema;
    private LocalDateTime createdAt;
}
