package com.transcribemd.repository;

import com.transcribemd.entity.Job;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobRepository extends JpaRepository<Job, String> {

    List<Job> findAllByOrderByCreatedAtDesc();

    List<Job> findByStatusOrderByCreatedAtDesc(Job.JobStatus status);

    @Query("SELECT j FROM Job j WHERE j.status NOT IN ('EXPORTED', 'FAILED') ORDER BY j.createdAt DESC")
    List<Job> findActiveJobs();
}
