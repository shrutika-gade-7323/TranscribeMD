package com.transcribemd.service;

import com.transcribemd.dto.TemplateDto;
import com.transcribemd.entity.Template;
import com.transcribemd.repository.TemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class TemplateService {

    private final TemplateRepository templateRepository;
    private final StorageService storageService;

    public Template uploadTemplate(MultipartFile file, String name, String clinicId, String procedureType) {
        String id = UUID.randomUUID().toString();
        String key = "templates/" + id + "/" + file.getOriginalFilename();
        storageService.store(file, key);

        Template template = Template.builder()
                .id(id)
                .name(name)
                .clinicId(clinicId)
                .procedureType(procedureType)
                .fileKey(key)
                .build();

        return templateRepository.save(template);
    }

    public List<TemplateDto> getAllTemplates() {
        return templateRepository.findByActiveTrueOrderByCreatedAtDesc()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public Optional<Template> findById(String id) {
        return templateRepository.findById(id);
    }

    public Template selectTemplateForTranscript(String transcript, String clinicId) {
        // Layer 1: exact match by clinic and procedure detected in transcript
        String detectedProcedure = detectProcedureType(transcript);
        if (clinicId != null && detectedProcedure != null) {
            List<Template> matches = templateRepository.findByClinicIdAndActiveTrueOrderByCreatedAtDesc(clinicId);
            Optional<Template> exactMatch = matches.stream()
                    .filter(t -> detectedProcedure.equalsIgnoreCase(t.getProcedureType()))
                    .findFirst();
            if (exactMatch.isPresent()) {
                log.info("Template selected via exact match: {} for procedure {}", exactMatch.get().getName(), detectedProcedure);
                return exactMatch.get();
            }
        }

        // Layer 2: procedure-type match across all clinics
        if (detectedProcedure != null) {
            List<Template> byProcedure = templateRepository.findByProcedureTypeAndActiveTrueOrderByCreatedAtDesc(detectedProcedure);
            if (!byProcedure.isEmpty()) {
                log.info("Template selected via procedure type: {}", byProcedure.get(0).getName());
                return byProcedure.get(0);
            }
        }

        // Layer 3: first available template
        List<Template> all = templateRepository.findByActiveTrueOrderByCreatedAtDesc();
        if (!all.isEmpty()) {
            log.info("Template selected (fallback - first available): {}", all.get(0).getName());
            return all.get(0);
        }

        log.warn("No template found for transcript");
        return null;
    }

    private String detectProcedureType(String transcript) {
        if (transcript == null) return null;
        String lower = transcript.toLowerCase();
        if (lower.contains("chest x-ray") || lower.contains("chest xray") || lower.contains("pa and lateral")) return "CHEST_XRAY";
        if (lower.contains("mri") && lower.contains("brain")) return "MRI_BRAIN";
        if (lower.contains("mri") && lower.contains("spine")) return "MRI_SPINE";
        if (lower.contains("ct") && lower.contains("abdomen")) return "CT_ABDOMEN";
        if (lower.contains("ct") && lower.contains("chest")) return "CT_CHEST";
        if (lower.contains("ultrasound") || lower.contains("sonogram")) return "ULTRASOUND";
        if (lower.contains("echocardiogram") || lower.contains("echo")) return "ECHO";
        if (lower.contains("mammogram") || lower.contains("mammography")) return "MAMMOGRAPHY";
        return null;
    }

    public void deleteTemplate(String id) {
        templateRepository.findById(id).ifPresent(t -> {
            t.setActive(false);
            templateRepository.save(t);
        });
    }

    public TemplateDto toDto(Template t) {
        return TemplateDto.builder()
                .id(t.getId())
                .name(t.getName())
                .clinicId(t.getClinicId())
                .procedureType(t.getProcedureType())
                .active(t.isActive())
                .version(t.getVersion())
                .placeholderSchema(t.getPlaceholderSchema())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
