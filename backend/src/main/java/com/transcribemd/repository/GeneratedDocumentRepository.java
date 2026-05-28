package com.transcribemd.repository;

import com.transcribemd.entity.GeneratedDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GeneratedDocumentRepository extends JpaRepository<GeneratedDocument, String> {
    Optional<GeneratedDocument> findTopBySegmentIdOrderByVersionDesc(String segmentId);
}
