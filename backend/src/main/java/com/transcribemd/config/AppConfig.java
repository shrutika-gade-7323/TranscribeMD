package com.transcribemd.config;

import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;
import java.util.concurrent.Executor;

@Configuration
public class AppConfig implements WebMvcConfigurer {

    @Value("${transcribemd.storage.minio.endpoint:http://localhost:9000}")
    private String minioEndpoint;

    @Value("${transcribemd.storage.minio.access-key:minioadmin}")
    private String minioAccessKey;

    @Value("${transcribemd.storage.minio.secret-key:minioadmin123}")
    private String minioSecretKey;

    @Value("${transcribemd.storage.local.base-path:./uploads}")
    private String localStoragePath;

    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(minioEndpoint)
                .credentials(minioAccessKey, minioSecretKey)
                .build();
    }

    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder()
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(100 * 1024 * 1024));
    }

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("transcribe-");
        executor.initialize();
        return executor;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Content-Disposition")
                .allowCredentials(false);
    }

    // Create local storage directory on startup
    @Bean
    public String localStorageInit() {
        File dir = new File(localStoragePath);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return localStoragePath;
    }
}
