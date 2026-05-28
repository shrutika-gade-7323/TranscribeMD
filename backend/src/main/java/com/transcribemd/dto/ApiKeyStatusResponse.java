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
    private boolean anthropicConfigured;
    private String anthropicPartialKeyHint;
    private String anthropicSource;
    private LocalDateTime anthropicUpdatedAt;

    private boolean geminiConfigured;
    private String geminiPartialKeyHint;
    private String geminiSource;
    private LocalDateTime geminiUpdatedAt;

    private String activeProvider; // "gemini" or "anthropic"
}
