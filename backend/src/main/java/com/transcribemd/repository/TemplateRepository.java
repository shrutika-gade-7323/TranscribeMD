package com.transcribemd.repository;

import com.transcribemd.entity.Template;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TemplateRepository extends JpaRepository<Template, String> {
    List<Template> findByActiveTrueOrderByCreatedAtDesc();
    List<Template> findByClinicIdAndActiveTrueOrderByCreatedAtDesc(String clinicId);
    List<Template> findByProcedureTypeAndActiveTrueOrderByCreatedAtDesc(String procedureType);
}
