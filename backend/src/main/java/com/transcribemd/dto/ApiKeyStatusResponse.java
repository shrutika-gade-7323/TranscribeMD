package com.transcribemd.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiKeyStatusResponse {
    private boolean configured;
    private String partialKeyHint;
    private String source; // "DATABASE" or "ENVIRONMENT"
    private LocalDateTime updatedAt;
}
