package com.transcribemd.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.io.InputStream;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class AudioService {

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${transcribemd.ml-service.url:http://localhost:8000}")
    private String mlServiceUrl;

    @Value("${transcribemd.ml-service.timeout-seconds:300}")
    private int timeoutSeconds;

    public TranscriptionResult transcribe(InputStream audioStream, String fileName) {
        log.info("Sending audio to ML service for transcription: {}", fileName);

        try {
            MultipartBodyBuilder bodyBuilder = new MultipartBodyBuilder();
            bodyBuilder.part("file", new InputStreamResource(audioStream))
                    .filename(fileName)
                    .contentType(MediaType.APPLICATION_OCTET_STREAM);

            String response = webClientBuilder.build()
                    .post()
                    .uri(mlServiceUrl + "/transcribe")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(bodyBuilder.build()))
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .block();

            JsonNode json = objectMapper.readTree(response);
            return TranscriptionResult.builder()
                    .transcript(json.path("transcript").asText())
                    .language(json.path("language").asText("en"))
                    .durationSeconds(json.path("duration_seconds").asDouble(0))
                    .words(objectMapper.convertValue(json.path("words"), List.class))
                    .build();

        } catch (Exception e) {
            log.error("Transcription failed: {}", e.getMessage(), e);
            throw new RuntimeException("Audio transcription failed: " + e.getMessage(), e);
        }
    }

    public List<PatientBoundary> detectPatientBoundaries(String transcript) {
        log.info("Detecting patient boundaries in transcript");

        try {
            String response = webClientBuilder.build()
                    .post()
                    .uri(mlServiceUrl + "/detect-boundaries")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("transcript", transcript))
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(60))
                    .block();

            JsonNode json = objectMapper.readTree(response);
            return objectMapper.convertValue(
                    json.path("boundaries"),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, PatientBoundary.class)
            );
        } catch (Exception e) {
            log.error("Boundary detection failed: {}", e.getMessage());
            return List.of(); // Return empty — treat as single patient
        }
    }

    @lombok.Data
    @lombok.Builder
    public static class TranscriptionResult {
        private String transcript;
        private String language;
        private double durationSeconds;
        private List<Map<String, Object>> words;
    }

    @lombok.Data
    public static class PatientBoundary {
        private int characterIndex;
        private double confidence;
        private String evidence;
        private String extractedPatientName;
        private String extractedMrn;
    }
}
