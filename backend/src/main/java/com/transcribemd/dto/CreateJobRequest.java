package com.transcribemd.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreateJobRequest {
    private String expectedClinicId;
    private String expectedDoctorId;
    private List<ExpectedPatient> expectedPatients;

    @Data
    public static class ExpectedPatient {
        private String name;
        private String mrn;
        private String dob;
    }
}
