# ==========================================
# 1. Build Stage
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Khai báo Build Arguments cho các biến môi trường Vite (nếu muốn truyền lúc docker build)
ARG VITE_API_BASE_URL=""

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy package files
COPY package*.json ./

# Cài đặt dependencies (bao gồm devDependencies để build)
RUN npm ci --prefer-offline --no-audit

# Copy toàn bộ source code
COPY . .

# Build ứng dụng (Vite xuất ra thư mục dist)
RUN npm run build

# ==========================================
# 2. Production Stage (Nginx)
# ==========================================
FROM nginx:1.27-alpine AS runner

# Copy file cấu hình Nginx hỗ trợ SPA React Router, WebSocket và gzip
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy kết quả build từ builder stage vào Nginx web root
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 cho web server
EXPOSE 80

# Chạy Nginx ở foreground
CMD ["nginx", "-g", "daemon off;"]
