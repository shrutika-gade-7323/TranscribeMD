package com.transcribemd.service;

import com.transcribemd.dto.ApiKeyStatusResponse;
import com.transcribemd.entity.SystemSetting;
import com.transcribemd.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class SettingsService {

    private final SystemSettingRepository systemSettingRepository;
    private final WebClient.Builder webClientBuilder;

    @Value("${spring.ai.anthropic.api-key:}")
    private String defaultApiKey;

    private static final String SETTING_KEY_ANTHROPIC = "anthropic.api_key";
    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com";

    /**
     * Resolves the active Anthropic API key.
     * Prioritizes the database setting, falls back to the environment configuration.
     */
    public String getActiveApiKey() {
        Optional<SystemSetting> settingOpt = systemSettingRepository.findById(SETTING_KEY_ANTHROPIC);
        if (settingOpt.isPresent()) {
            String dbVal = settingOpt.get().getValue();
            if (dbVal != null && !dbVal.isBlank()) {
                return dbVal;
            }
        }
        return defaultApiKey;
    }

    /**
     * Retrieves the metadata status of the currently active key.
     */
    public ApiKeyStatusResponse getApiKeyStatus() {
        Optional<SystemSetting> settingOpt = systemSettingRepository.findById(SETTING_KEY_ANTHROPIC);
        String activeKey = defaultApiKey;
        String source = "ENVIRONMENT";
        LocalDateTime updatedAt = LocalDateTime.now();

        if (settingOpt.isPresent()) {
            String dbVal = settingOpt.get().getValue();
            if (dbVal != null && !dbVal.isBlank()) {
                activeKey = dbVal;
                source = "DATABASE";
                updatedAt = settingOpt.get().getUpdatedAt();
            }
        }

        boolean configured = activeKey != null && !activeKey.isBlank() && !activeKey.startsWith("your-");
        String hint = maskKey(activeKey);

        return ApiKeyStatusResponse.builder()
                .configured(configured)
                .partialKeyHint(hint)
                .source(source)
                .updatedAt(updatedAt)
                .build();
    }

    /**
     * Replaces the active key in the database directly.
     */
    public void saveActiveKey(String key) {
        SystemSetting setting = systemSettingRepository.findById(SETTING_KEY_ANTHROPIC)
                .orElse(SystemSetting.builder()
                        .key(SETTING_KEY_ANTHROPIC)
                        .value("")
                        .build());
        setting.setValue(key);
        setting.setUpdatedAt(LocalDateTime.now());
        systemSettingRepository.save(setting);
        log.info("Successfully updated active Anthropic API Key in database settings");
    }

    /**
     * Verifies the status of a specific API key against the Anthropic Org API.
     */
    public String verifyApiKey(String apiKeyId, String adminApiKey) {
        log.info("Verifying API Key ID: {} against Anthropic Organizations API", apiKeyId);
        try {
            return webClientBuilder.build()
                    .get()
                    .uri(ANTHROPIC_API_URL + "/v1/organizations/api_keys/" + apiKeyId)
                    .header("X-Api-Key", adminApiKey)
                    .header("anthropic-version", "2023-06-01")
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(15))
                    .block();
        } catch (Exception e) {
            log.error("Failed to verify API Key on Anthropic API: {}", e.getMessage());
            throw new RuntimeException("Anthropic API Key verification failed: " + e.getMessage(), e);
        }
    }

    private String maskKey(String key) {
        if (key == null || key.isBlank() || key.startsWith("your-")) {
            return "Not Configured";
        }
        if (key.length() <= 12) {
            return "********";
        }
        // Format e.g., sk-ant-api03-R2D...igAA
        if (key.startsWith("sk-ant-")) {
            int prefixLen = Math.min(key.length(), 15);
            return key.substring(0, prefixLen) + "..." + key.substring(key.length() - Math.min(key.length() - prefixLen, 4));
        }
        return key.substring(0, 6) + "..." + key.substring(key.length() - 4);
    }
}
