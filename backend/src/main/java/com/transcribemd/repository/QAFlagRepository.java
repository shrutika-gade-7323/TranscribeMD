package com.transcribemd.repository;

import com.transcribemd.entity.QAFlag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QAFlagRepository extends JpaRepository<QAFlag, String> {
    List<QAFlag> findBySegmentIdOrderByCreatedAtDesc(String segmentId);
    List<QAFlag> findBySegmentIdAndResolvedFalse(String segmentId);
}
