package com.transcribemd.service;

import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@RequiredArgsConstructor
public class StorageService {

    @Value("${transcribemd.storage.type:local}")
    private String storageType;

    @Value("${transcribemd.storage.local.base-path:./uploads}")
    private String localBasePath;

    @Value("${transcribemd.storage.minio.bucket:transcribemd}")
    private String minioBucket;

    private final MinioClient minioClient;

    public String store(MultipartFile file, String key) {
        try {
            if ("minio".equals(storageType)) {
                return storeInMinio(file, key);
            } else {
                return storeLocally(file, key);
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to store file: " + key, e);
        }
    }

    public String store(byte[] data, String key, String contentType) {
        try {
            if ("minio".equals(storageType)) {
                return storeInMinio(data, key, contentType);
            } else {
                return storeLocallyBytes(data, key);
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to store data: " + key, e);
        }
    }

    public InputStream retrieve(String key) {
        try {
            if ("minio".equals(storageType)) {
                return minioClient.getObject(GetObjectArgs.builder()
                        .bucket(minioBucket)
                        .object(key)
                        .build());
            } else {
                return new FileInputStream(localBasePath + File.separator + key.replace("/", File.separator));
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to retrieve file: " + key, e);
        }
    }

    public String getPresignedUrl(String key) {
        try {
            if ("minio".equals(storageType)) {
                return minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                        .method(Method.GET)
                        .bucket(minioBucket)
                        .object(key)
                        .expiry(2, TimeUnit.HOURS)
                        .build());
            } else {
                return "/api/v1/files/" + key;
            }
        } catch (Exception e) {
            log.warn("Could not generate presigned URL for {}: {}", key, e.getMessage());
            return "/api/v1/files/" + key;
        }
    }

    public boolean exists(String key) {
        try {
            if ("minio".equals(storageType)) {
                minioClient.statObject(StatObjectArgs.builder().bucket(minioBucket).object(key).build());
                return true;
            } else {
                return Files.exists(Paths.get(localBasePath, key));
            }
        } catch (Exception e) {
            return false;
        }
    }

    private String storeInMinio(MultipartFile file, String key) throws Exception {
        ensureBucketExists();
        minioClient.putObject(PutObjectArgs.builder()
                .bucket(minioBucket)
                .object(key)
                .stream(file.getInputStream(), file.getSize(), -1)
                .contentType(file.getContentType())
                .build());
        return key;
    }

    private String storeInMinio(byte[] data, String key, String contentType) throws Exception {
        ensureBucketExists();
        minioClient.putObject(PutObjectArgs.builder()
                .bucket(minioBucket)
                .object(key)
                .stream(new ByteArrayInputStream(data), data.length, -1)
                .contentType(contentType)
                .build());
        return key;
    }

    private String storeLocally(MultipartFile file, String key) throws Exception {
        Path path = Paths.get(localBasePath, key.replace("/", File.separator));
        Files.createDirectories(path.getParent());
        file.transferTo(path.toFile());
        return key;
    }

    private String storeLocallyBytes(byte[] data, String key) throws Exception {
        Path path = Paths.get(localBasePath, key.replace("/", File.separator));
        Files.createDirectories(path.getParent());
        Files.write(path, data);
        return key;
    }

    private void ensureBucketExists() throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(minioBucket).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(minioBucket).build());
        }
    }
}
