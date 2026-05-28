package com.transcribemd.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerifyApiKeyRequest {
    private String apiKeyId;
    private String adminApiKey;
    private boolean saveAsActive;
}
