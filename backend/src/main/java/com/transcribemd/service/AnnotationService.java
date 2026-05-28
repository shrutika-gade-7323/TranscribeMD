package com.transcribemd.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class AnnotationService {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;
    private final SettingsService settingsService;

    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com";
    private static final String MODEL = "claude-sonnet-4-6";

    private static final String SYSTEM_PROMPT = """
            You are a medical transcription annotation engine. Analyze a doctor's dictation transcript and produce structured JSON.

            CRITICAL RULES:
            - DO NOT change any medical content — only annotate it
            - Every word in the output must exist verbatim in the input transcript
            - Output ONLY valid JSON, no markdown code fences, no explanation

            JSON Schema:
            {
              "patient": {"name": "string|null", "mrn": "string|null", "dob": "string|null", "procedure": "string|null"},
              "sections": [{
                "heading": "SECTION NAME",
                "headingFormat": {"allCaps": true, "bold": true, "underline": false, "alignment": "LEFT"},
                "bodyFormat": {"fontFamily": "Times New Roman", "fontSize": 12, "alignment": "LEFT"},
                "listStyle": "NONE|NUMBERED|BULLETED",
                "items": [{
                  "runs": [{"text": "verbatim text", "format": {"bold": false, "italic": false, "underline": false, "allCaps": false}}],
                  "imageRef": {"imageId": "img_N", "anchorText": "phrase"} or null
                }]
              }]
            }

            Common sections: TECHNIQUE, CLINICAL HISTORY, FINDINGS, IMPRESSION, COMPARISON, INDICATION
            Headings default to ALL CAPS + bold. Body default: Times New Roman 12pt, left-aligned.
            """;

    public AnnotatedTranscript annotate(String rawTranscript) {
        log.info("Annotating transcript ({} chars)", rawTranscript.length());

        String activeKey = settingsService.getActiveApiKey();
        if (activeKey == null || activeKey.isBlank() || activeKey.startsWith("your-")) {
            log.warn("No Anthropic API key configured — using fallback annotation");
            return new AnnotatedTranscript(buildFallbackAnnotation(rawTranscript), false, "No API key");
        }

        try {
            Map<String, Object> requestBody = Map.of(
                    "model", MODEL,
                    "max_tokens", 8000,
                    "system", SYSTEM_PROMPT,
                    "messages", List.of(
                            Map.of("role", "user",
                                    "content", "Annotate this medical dictation:\n\n" + rawTranscript)
                    )
            );

            String response = webClientBuilder.build()
                    .post()
                    .uri(ANTHROPIC_API_URL + "/v1/messages")
                    .header("x-api-key", activeKey)
                    .header("anthropic-version", "2023-06-01")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(60))
                    .block();

            JsonNode responseJson = objectMapper.readTree(response);
            String content = responseJson
                    .path("content")
                    .get(0)
                    .path("text")
                    .asText();

            String cleanJson = extractJson(content);
            objectMapper.readTree(cleanJson); // validate
            log.info("Annotation successful");
            return new AnnotatedTranscript(cleanJson, true, null);

        } catch (Exception e) {
            log.error("Annotation failed: {}", e.getMessage());
            return new AnnotatedTranscript(buildFallbackAnnotation(rawTranscript), false, e.getMessage());
        }
    }

    private String extractJson(String text) {
        String trimmed = text.trim();
        // Strip markdown code fences if present
        if (trimmed.startsWith("```")) {
            int start = trimmed.indexOf('{');
            int end = trimmed.lastIndexOf('}');
            if (start != -1 && end != -1) return trimmed.substring(start, end + 1);
        }
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        return (start != -1 && end != -1) ? trimmed.substring(start, end + 1) : trimmed;
    }

    private String buildFallbackAnnotation(String rawTranscript) {
        // Parse transcript naively into sections by known keywords
        String escaped = rawTranscript
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "");

        return """
                {
                  "patient": {"name": null, "mrn": null, "dob": null, "procedure": null},
                  "sections": [
                    {
                      "heading": "TRANSCRIPTION",
                      "headingFormat": {"allCaps": true, "bold": true, "underline": false, "alignment": "LEFT"},
                      "bodyFormat": {"fontFamily": "Times New Roman", "fontSize": 12, "alignment": "LEFT"},
                      "listStyle": "NONE",
                      "items": [{"runs": [{"text": "%s", "format": {"bold": false, "italic": false, "underline": false, "allCaps": false}}], "imageRef": null}]
                    }
                  ]
                }
                """.formatted(escaped);
    }

    public record AnnotatedTranscript(String json, boolean success, String error) {}
}
