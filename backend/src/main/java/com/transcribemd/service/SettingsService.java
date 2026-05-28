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
    private String defaultAnthropicKey;

    @Value("${spring.ai.gemini.api-key:}")
    private String defaultGeminiKey;

    @Value("${spring.ai.llm.provider:gemini}")
    private String defaultLlmProvider;

    private static final String SETTING_KEY_ANTHROPIC = "anthropic.api_key";
    private static final String SETTING_KEY_GEMINI = "gemini.api_key";
    private static final String SETTING_KEY_PROVIDER = "llm.provider";

    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com";

    /**
     * Resolves the active provider ("gemini" or "anthropic").
     */
    public String getActiveProvider() {
        Optional<SystemSetting> settingOpt = systemSettingRepository.findById(SETTING_KEY_PROVIDER);
        if (settingOpt.isPresent()) {
            String dbVal = settingOpt.get().getValue();
            if (dbVal != null && !dbVal.isBlank()) {
                return dbVal.trim().toLowerCase();
            }
        }
        return defaultLlmProvider != null ? defaultLlmProvider.trim().toLowerCase() : "gemini";
    }

    /**
     * Saves the active provider in the database.
     */
    public void saveActiveProvider(String provider) {
        String cleaned = (provider == null || provider.isBlank()) ? "gemini" : provider.trim().toLowerCase();
        SystemSetting setting = systemSettingRepository.findById(SETTING_KEY_PROVIDER)
                .orElse(SystemSetting.builder()
                        .key(SETTING_KEY_PROVIDER)
                        .value("")
                        .build());
        setting.setValue(cleaned);
        setting.setUpdatedAt(LocalDateTime.now());
        systemSettingRepository.save(setting);
        log.info("Successfully updated active LLM provider to: {}", cleaned);
    }

    /**
     * Resolves the active LLM API key based on the configured provider.
     */
    public String getActiveApiKey() {
        String provider = getActiveProvider();
        if ("anthropic".equals(provider)) {
            return getAnthropicApiKey();
        } else {
            return getGeminiApiKey();
        }
    }

    /**
     * Resolves the Anthropic API key.
     */
    public String getAnthropicApiKey() {
        Optional<SystemSetting> settingOpt = systemSettingRepository.findById(SETTING_KEY_ANTHROPIC);
        if (settingOpt.isPresent()) {
            String dbVal = settingOpt.get().getValue();
            if (dbVal != null && !dbVal.isBlank()) {
                return dbVal;
            }
        }
        return defaultAnthropicKey;
    }

    /**
     * Resolves the Gemini API key.
     */
    public String getGeminiApiKey() {
        Optional<SystemSetting> settingOpt = systemSettingRepository.findById(SETTING_KEY_GEMINI);
        if (settingOpt.isPresent()) {
            String dbVal = settingOpt.get().getValue();
            if (dbVal != null && !dbVal.isBlank()) {
                return dbVal;
            }
        }
        return defaultGeminiKey;
    }

    /**
     * Retrieves the metadata status of both API keys and active provider.
     */
    public ApiKeyStatusResponse getApiKeyStatus() {
        Optional<SystemSetting> anthropicOpt = systemSettingRepository.findById(SETTING_KEY_ANTHROPIC);
        String anthropicKey = defaultAnthropicKey;
        String anthropicSource = "ENVIRONMENT";
        LocalDateTime anthropicUpdatedAt = LocalDateTime.now();

        if (anthropicOpt.isPresent()) {
            String dbVal = anthropicOpt.get().getValue();
            if (dbVal != null && !dbVal.isBlank()) {
                anthropicKey = dbVal;
                anthropicSource = "DATABASE";
                anthropicUpdatedAt = anthropicOpt.get().getUpdatedAt();
            }
        }

        Optional<SystemSetting> geminiOpt = systemSettingRepository.findById(SETTING_KEY_GEMINI);
        String geminiKey = defaultGeminiKey;
        String geminiSource = "ENVIRONMENT";
        LocalDateTime geminiUpdatedAt = LocalDateTime.now();

        if (geminiOpt.isPresent()) {
            String dbVal = geminiOpt.get().getValue();
            if (dbVal != null && !dbVal.isBlank()) {
                geminiKey = dbVal;
                geminiSource = "DATABASE";
                geminiUpdatedAt = geminiOpt.get().getUpdatedAt();
            }
        }

        boolean anthropicConfigured = anthropicKey != null && !anthropicKey.isBlank() && !anthropicKey.startsWith("your-");
        boolean geminiConfigured = geminiKey != null && !geminiKey.isBlank() && !geminiKey.startsWith("your-");

        return ApiKeyStatusResponse.builder()
                .anthropicConfigured(anthropicConfigured)
                .anthropicPartialKeyHint(maskKey(anthropicKey, "sk-ant-"))
                .anthropicSource(anthropicSource)
                .anthropicUpdatedAt(anthropicUpdatedAt)
                .geminiConfigured(geminiConfigured)
                .geminiPartialKeyHint(maskKey(geminiKey, "AIzaSy"))
                .geminiSource(geminiSource)
                .geminiUpdatedAt(geminiUpdatedAt)
                .activeProvider(getActiveProvider())
                .build();
    }

    /**
     * Replaces the active key for a specific provider in the database directly.
     */
    public void saveActiveKey(String provider, String key) {
        String keyName = "anthropic".equalsIgnoreCase(provider) ? SETTING_KEY_ANTHROPIC : SETTING_KEY_GEMINI;
        SystemSetting setting = systemSettingRepository.findById(keyName)
                .orElse(SystemSetting.builder()
                        .key(keyName)
                        .value("")
                        .build());
        setting.setValue(key);
        setting.setUpdatedAt(LocalDateTime.now());
        systemSettingRepository.save(setting);
        log.info("Successfully updated active {} API Key in database settings", provider);
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

    /**
     * Verifies a Gemini API key against Google's model list endpoint.
     */
    public String verifyGeminiApiKey(String apiKey) {
        log.info("Verifying Gemini API key against Google API");
        try {
            return webClientBuilder.build()
                    .get()
                    .uri("https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(15))
                    .block();
        } catch (Exception e) {
            log.error("Failed to verify Gemini API Key on Google API: {}", e.getMessage());
            throw new RuntimeException("Gemini API Key verification failed: " + e.getMessage(), e);
        }
    }

    private String maskKey(String key, String expectedPrefix) {
        if (key == null || key.isBlank() || key.startsWith("your-")) {
            return "Not Configured";
        }
        if (key.length() <= 12) {
            return "********";
        }
        if (key.startsWith(expectedPrefix)) {
            int prefixLen = Math.min(key.length(), expectedPrefix.length() + 8);
            return key.substring(0, prefixLen) + "..." + key.substring(key.length() - Math.min(key.length() - prefixLen, 4));
        }
        return key.substring(0, 6) + "..." + key.substring(key.length() - 4);
    }
}
