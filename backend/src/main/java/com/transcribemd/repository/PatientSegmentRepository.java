package com.transcribemd.repository;

import com.transcribemd.entity.PatientSegment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PatientSegmentRepository extends JpaRepository<PatientSegment, String> {
    List<PatientSegment> findByJobIdOrderBySequenceIndex(String jobId);
}
