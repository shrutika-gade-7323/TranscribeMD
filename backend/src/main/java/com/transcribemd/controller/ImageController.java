package com.transcribemd.controller;

import com.transcribemd.repository.ImageRepository;
import com.transcribemd.service.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/images")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Images", description = "Image management")
public class ImageController {

    private final ImageRepository imageRepository;
    private final StorageService storageService;

    @GetMapping("/{id}")
    @Operation(summary = "Serve an image file")
    public ResponseEntity<byte[]> getImage(@PathVariable String id) {
        return imageRepository.findById(id)
                .map(img -> {
                    try (var stream = storageService.retrieve(img.getFileKey())) {
                        byte[] bytes = stream.readAllBytes();
                        String contentType = img.getMimeType() != null ? img.getMimeType() : "image/png";
                        return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_TYPE, contentType)
                                .header(HttpHeaders.CACHE_CONTROL, "max-age=3600")
                                .body(bytes);
                    } catch (Exception e) {
                        log.error("Failed to read image {}: {}", id, e.getMessage());
                        return ResponseEntity.internalServerError().<byte[]>build();
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
