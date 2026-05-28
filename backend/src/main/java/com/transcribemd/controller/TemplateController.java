package com.transcribemd.controller;

import com.transcribemd.dto.TemplateDto;
import com.transcribemd.service.StorageService;
import com.transcribemd.service.TemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/templates")
@RequiredArgsConstructor
@Tag(name = "Templates", description = "Word template management")
public class TemplateController {

    private final TemplateService templateService;
    private final StorageService storageService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload a new Word template")
    public ResponseEntity<TemplateDto> uploadTemplate(
            @RequestPart("file") MultipartFile file,
            @RequestPart("name") String name,
            @RequestPart(value = "clinicId", required = false) String clinicId,
            @RequestPart(value = "procedureType", required = false) String procedureType
    ) {
        var template = templateService.uploadTemplate(file, name, clinicId, procedureType);
        return ResponseEntity.ok(templateService.toDto(template));
    }

    @GetMapping
    @Operation(summary = "List all active templates")
    public ResponseEntity<List<TemplateDto>> listTemplates() {
        return ResponseEntity.ok(templateService.getAllTemplates());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get template by ID")
    public ResponseEntity<TemplateDto> getTemplate(@PathVariable String id) {
        return templateService.findById(id)
                .map(t -> ResponseEntity.ok(templateService.toDto(t)))
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Deactivate a template")
    public ResponseEntity<?> deleteTemplate(@PathVariable String id) {
        templateService.deleteTemplate(id);
        return ResponseEntity.ok(Map.of("message", "Template deactivated"));
    }
}
