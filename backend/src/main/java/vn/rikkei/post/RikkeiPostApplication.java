package vn.rikkei.post;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main Application Class cho hệ thống Rikkei_Post
 * Phát triển độc lập bởi: Nguyễn Công Hưởng (Solo Fullstack Lead & AI Architect)
 * Nền tảng: Java 21, Spring Boot 4.1.x / 3.3.x, Spring AI 2.0, Code-First ORM
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class RikkeiPostApplication {

    public static void main(String[] args) {
        SpringApplication.run(RikkeiPostApplication.class, args);
    }
}
