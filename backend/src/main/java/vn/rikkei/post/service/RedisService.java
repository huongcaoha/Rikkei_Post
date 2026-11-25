package vn.rikkei.post.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedisService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final CacheManager cacheManager;

    private static final String JWT_BLACKLIST_PREFIX = "rkp:jwt:blacklist:";
    private static final String LOCK_PREFIX = "rkp:lock:";

    /**
     * Lấy giá trị từ Redis
     */
    public Object get(String key) {
        try {
            return redisTemplate.opsForValue().get(key);
        } catch (Exception e) {
            log.warn("Lỗi khi đọc key '{}' từ Redis: {}", key, e.getMessage());
            return null;
        }
    }

    /**
     * Ghi giá trị vào Redis kèm thời gian sống (TTL)
     */
    public void set(String key, Object value, long timeout, TimeUnit unit) {
        try {
            redisTemplate.opsForValue().set(key, value, timeout, unit);
        } catch (Exception e) {
            log.warn("Lỗi khi ghi key '{}' vào Redis: {}", key, e.getMessage());
        }
    }

    /**
     * Kiểm tra sự tồn tại của key
     */
    public boolean hasKey(String key) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(key));
        } catch (Exception e) {
            log.warn("Lỗi khi kiểm tra key '{}' trên Redis: {}", key, e.getMessage());
            return false;
        }
    }

    /**
     * Xóa 1 key khỏi Redis
     */
    public boolean delete(String key) {
        try {
            return Boolean.TRUE.equals(redisTemplate.delete(key));
        } catch (Exception e) {
            log.warn("Lỗi khi xóa key '{}' trên Redis: {}", key, e.getMessage());
            return false;
        }
    }

    /**
     * Xóa các keys khớp với pattern (ví dụ: "rkp:order:tracking:*")
     */
    public void deleteByPattern(String pattern) {
        try {
            Set<String> keys = redisTemplate.keys(pattern);
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.debug("Đã xóa {} keys với pattern: {}", keys.size(), pattern);
            }
        } catch (Exception e) {
            log.warn("Lỗi khi xóa keys theo pattern '{}' trên Redis: {}", pattern, e.getMessage());
        }
    }

    /**
     * Đưa Access Token vào blacklist khi người dùng đăng xuất (TTL = thời gian còn lại của token)
     */
    public void blacklistToken(String token, long ttlMillis) {
        if (token == null || token.isBlank()) return;
        try {
            long ttl = ttlMillis > 0 ? ttlMillis : 600000;
            redisTemplate.opsForValue().set(JWT_BLACKLIST_PREFIX + token, "revoked", ttl, TimeUnit.MILLISECONDS);
            log.debug("Đã đưa token vào Redis blacklist trong {} ms", ttl);
        } catch (Exception e) {
            log.warn("Lỗi khi lưu token vào blacklist Redis: {}", e.getMessage());
        }
    }

    /**
     * Kiểm tra xem Token có nằm trong blacklist không (O(1) trên RAM)
     */
    public boolean isTokenBlacklisted(String token) {
        if (token == null || token.isBlank()) return false;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(JWT_BLACKLIST_PREFIX + token));
        } catch (Exception e) {
            log.warn("Lỗi kiểm tra token blacklist trên Redis: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Khóa phân tán (Distributed Lock) dựa trên SETNX của Redis.
     * Tránh tình trạng đua tranh (Race condition) hoặc xử lý trùng lặp Kafka message / Backup.
     *
     * @param lockKey Tên lock (ví dụ: "backup:lock")
     * @param lockValue Giá trị định danh (UUID hoặc worker ID)
     * @param expireSeconds Thời gian tự giải phóng khóa nếu tiến trình gặp sự cố
     * @return true nếu lấy được khóa, false nếu đang có tiến trình khác giữ khóa
     */
    public boolean acquireLock(String lockKey, String lockValue, long expireSeconds) {
        try {
            String fullKey = LOCK_PREFIX + lockKey;
            Boolean acquired = redisTemplate.opsForValue().setIfAbsent(fullKey, lockValue, expireSeconds, TimeUnit.SECONDS);
            return Boolean.TRUE.equals(acquired);
        } catch (Exception e) {
            log.warn("Lỗi khi acquire lock '{}': {}", lockKey, e.getMessage());
            return true; // Cho phép tiếp tục nếu Redis tạm thời không phản hồi
        }
    }

    /**
     * Giải phóng Distributed Lock an toàn (chỉ giải phóng nếu value trùng khớp)
     */
    public boolean releaseLock(String lockKey, String lockValue) {
        try {
            String fullKey = LOCK_PREFIX + lockKey;
            Object currentVal = redisTemplate.opsForValue().get(fullKey);
            if (Objects.equals(currentVal, lockValue)) {
                return Boolean.TRUE.equals(redisTemplate.delete(fullKey));
            }
            return false;
        } catch (Exception e) {
            log.warn("Lỗi khi release lock '{}': {}", lockKey, e.getMessage());
            return false;
        }
    }

    /**
     * Xóa cache theo cache name và key cụ thể
     */
    public void evictCache(String cacheName, Object key) {
        try {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                cache.evict(key);
                log.debug("Đã evict cache '{}' cho key '{}'", cacheName, key);
            }
        } catch (Exception e) {
            log.warn("Lỗi khi evict cache '{}' cho key '{}': {}", cacheName, key, e.getMessage());
        }
    }

    /**
     * Xóa toàn bộ dữ liệu trong một cache
     */
    public void clearCache(String cacheName) {
        try {
            Cache cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                cache.clear();
                log.info("Đã clear toàn bộ cache '{}'", cacheName);
            }
        } catch (Exception e) {
            log.warn("Lỗi khi clear cache '{}': {}", cacheName, e.getMessage());
        }
    }

    /**
     * Tiện ích xóa toàn bộ cache liên quan đến đơn hàng khi trạng thái thay đổi
     */
    public void evictOrderCache(String trackingCode) {
        if (trackingCode == null || trackingCode.isBlank()) return;
        evictCache("order:tracking", trackingCode);
        evictCache("order:timeline", trackingCode);
    }
}
