# ==========================================
# 1. Build Stage
# ==========================================
FROM eclipse-temurin:21-jdk-jammy AS builder

WORKDIR /app

# Copy các tệp Gradle wrapper và cấu hình dự án
COPY gradlew ./
COPY gradle ./gradle
COPY build.gradle settings.gradle ./

# Đổi định dạng xuống dòng (phòng trường hợp commit từ Windows CRLF) và cấp quyền thực thi
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew

# Khởi tạo và tải trước Gradle wrapper cùng dependencies (thử lại tự động nếu gặp lỗi mạng tạm thời)
RUN for i in 1 2 3 4 5; do \
        ./gradlew --version --no-daemon && break || sleep 3; \
    done && \
    ./gradlew dependencies --no-daemon || true

# Copy toàn bộ mã nguồn
COPY src ./src

# Build file jar của ứng dụng (bỏ qua chạy unit tests khi build image)
RUN ./gradlew bootJar -x test --no-daemon

# Lấy file jar runnable (loại trừ file plain jar) và chuẩn hóa tên thành app.jar
RUN cp $(ls build/libs/*.jar | grep -v 'plain' | head -n 1) app.jar

# ==========================================
# 2. Production Runtime Stage
# ==========================================
FROM eclipse-temurin:21-jre-alpine AS runner

WORKDIR /app

# Cài đặt các công cụ hỗ trợ và PostgreSQL client trên Alpine
RUN apk add --no-cache \
        ca-certificates \
        curl \
        postgresql-client \
        tzdata

# Thiết lập múi giờ Việt Nam
ENV TZ=Asia/Ho_Chi_Minh
RUN cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && echo "Asia/Ho_Chi_Minh" > /etc/timezone

# Tạo non-root user 'spring' để đảm bảo an toàn bảo mật khi chạy container
RUN addgroup -S spring && adduser -S spring -G spring

# Tạo sẵn thư mục lưu trữ backups và phân quyền cho user spring
RUN mkdir -p /app/backups && chown -R spring:spring /app

# Copy file jar đã build từ builder stage và phân quyền cho user spring
COPY --from=builder --chown=spring:spring /app/app.jar app.jar

# Chuyển sang non-root user
USER spring:spring

# Expose cổng mặc định của Spring Boot
EXPOSE 8080

# Cấu hình tối ưu bộ nhớ JVM khi chạy trong môi trường container (giới hạn 512M heap để tránh tràn RAM VPS)
ENV JAVA_OPTS="-XX:+UseContainerSupport -Xmx512M -Xms256M -Xss2M -XX:+UseG1GC"

# Lệnh khởi chạy ứng dụng
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
