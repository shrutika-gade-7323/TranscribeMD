package com.transcribemd.controller;

import com.transcribemd.dto.ApiKeyStatusResponse;
import com.transcribemd.dto.UpdateApiKeyRequest;
import com.transcribemd.dto.VerifyApiKeyRequest;
import com.transcribemd.service.SettingsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
@Slf4j
public class SettingsController {

    private final SettingsService settingsService;

    @GetMapping("/anthropic-key")
    public ResponseEntity<ApiKeyStatusResponse> getApiKeyStatus() {
        return ResponseEntity.ok(settingsService.getApiKeyStatus());
    }

    @PostMapping("/anthropic-key")
    public ResponseEntity<ApiKeyStatusResponse> updateApiKey(@RequestBody UpdateApiKeyRequest request) {
        if (request.getApiKey() == null || request.getApiKey().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String provider = request.getProvider();
        if (provider == null || provider.isBlank()) {
            provider = "anthropic"; // default for backwards compatibility
        }
        settingsService.saveActiveKey(provider, request.getApiKey());
        return ResponseEntity.ok(settingsService.getApiKeyStatus());
    }

    @PostMapping("/provider")
    public ResponseEntity<ApiKeyStatusResponse> updateProvider(@RequestBody Map<String, String> request) {
        String provider = request.get("provider");
        if (provider == null || provider.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        settingsService.saveActiveProvider(provider);
        return ResponseEntity.ok(settingsService.getApiKeyStatus());
    }

    @PostMapping("/anthropic-key/verify")
    public ResponseEntity<String> verifyApiKey(@RequestBody VerifyApiKeyRequest request) {
        if (request.getApiKeyId() == null || request.getApiKeyId().isBlank() ||
            request.getAdminApiKey() == null || request.getAdminApiKey().isBlank()) {
            return ResponseEntity.badRequest().body("Both apiKeyId and adminApiKey are required.");
        }

        try {
            String verificationResult = settingsService.verifyApiKey(request.getApiKeyId(), request.getAdminApiKey());
            
            // If requested, save this admin key as the active transcription key upon successful verification
            if (request.isSaveAsActive()) {
                settingsService.saveActiveKey("anthropic", request.getAdminApiKey());
                log.info("Saved verified key as the active system Anthropic API Key");
            }
            
            return ResponseEntity.ok()
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(verificationResult);
        } catch (Exception e) {
            log.error("API Key verification endpoint failed: {}", e.getMessage());
            return ResponseEntity.status(502).body("{\"error\": \"" + e.getMessage().replace("\"", "\\\"") + "\"}");
        }
    }

    @PostMapping("/gemini-key/verify")
    public ResponseEntity<String> verifyGeminiApiKey(@RequestBody Map<String, String> request) {
        String apiKey = request.get("apiKey");
        if (apiKey == null || apiKey.isBlank()) {
            return ResponseEntity.badRequest().body("apiKey is required.");
        }

        try {
            String verificationResult = settingsService.verifyGeminiApiKey(apiKey);
            
            // Save if requested
            boolean saveAsActive = Boolean.parseBoolean(request.getOrDefault("saveAsActive", "false"));
            if (saveAsActive) {
                settingsService.saveActiveKey("gemini", apiKey);
                log.info("Saved verified key as the active system Gemini API Key");
            }
            
            return ResponseEntity.ok()
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(verificationResult);
        } catch (Exception e) {
            log.error("Gemini API Key verification endpoint failed: {}", e.getMessage());
            return ResponseEntity.status(502).body("{\"error\": \"" + e.getMessage().replace("\"", "\\\"") + "\"}");
        }
    }
}
