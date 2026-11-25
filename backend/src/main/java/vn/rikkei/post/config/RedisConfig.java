package vn.rikkei.post.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.databind.jsontype.PolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Configuration
@EnableCaching
public class RedisConfig implements CachingConfigurer {

    public static final String CACHE_ORDER_TRACKING = "order:tracking";
    public static final String CACHE_ORDER_TIMELINE = "order:timeline";
    public static final String CACHE_LOCATIONS_PROVINCES = "locations:provinces";
    public static final String CACHE_LOCATIONS_WARDS = "locations:wards";
    public static final String CACHE_WAREHOUSES = "locations:warehouses";
    public static final String CACHE_PRICING_POLICIES = "pricing:policies";
    public static final String CACHE_PRICING_MATRIX = "pricing:matrix";
    public static final String CACHE_TOPOLOGY = "network:topology";

    @Bean
    public GenericJackson2JsonRedisSerializer redisJsonSerializer() {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        PolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator.builder()
                .allowIfBaseType(Object.class)
                .build();
        objectMapper.activateDefaultTyping(ptv, ObjectMapper.DefaultTyping.NON_FINAL, JsonTypeInfo.As.PROPERTY);
        return new GenericJackson2JsonRedisSerializer(objectMapper);
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory,
                                                       GenericJackson2JsonRedisSerializer redisJsonSerializer) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);

        template.setValueSerializer(redisJsonSerializer);
        template.setHashValueSerializer(redisJsonSerializer);

        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory,
                                          GenericJackson2JsonRedisSerializer redisJsonSerializer) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(30))
                .disableCachingNullValues()
                .computePrefixWith(cacheName -> "rkp:" + cacheName + ":")
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(redisJsonSerializer));

        Map<String, RedisCacheConfiguration> cacheConfigs = new HashMap<>();

        // 1. Tra cứu thông tin đơn hàng & timeline (15 phút, xóa ngay khi cập nhật trạng thái đơn)
        cacheConfigs.put(CACHE_ORDER_TRACKING, defaultConfig.entryTtl(Duration.ofMinutes(15)));
        cacheConfigs.put(CACHE_ORDER_TIMELINE, defaultConfig.entryTtl(Duration.ofMinutes(15)));

        // 2. Danh mục địa giới hành chính (63 Tỉnh/TP và 3321 Xã/Phường: dữ liệu tĩnh, lưu 24h)
        cacheConfigs.put(CACHE_LOCATIONS_PROVINCES, defaultConfig.entryTtl(Duration.ofHours(24)));
        cacheConfigs.put(CACHE_LOCATIONS_WARDS, defaultConfig.entryTtl(Duration.ofHours(24)));

        // 3. Chính sách giá cước và ma trận cước vận chuyển (lưu 6h, tự evict khi Admin điều chỉnh giá)
        cacheConfigs.put(CACHE_PRICING_POLICIES, defaultConfig.entryTtl(Duration.ofHours(6)));
        cacheConfigs.put(CACHE_PRICING_MATRIX, defaultConfig.entryTtl(Duration.ofHours(6)));

        // 4. Mạng lưới kho bưu cục WMS và Network Topology (lưu 2h)
        cacheConfigs.put(CACHE_WAREHOUSES, defaultConfig.entryTtl(Duration.ofHours(2)));
        cacheConfigs.put(CACHE_TOPOLOGY, defaultConfig.entryTtl(Duration.ofHours(2)));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigs)
                .build();
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Redis GET error on cache '{}' for key '{}': {}. Falling back to database.",
                        cache != null ? cache.getName() : "unknown", key, exception.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
                log.warn("Redis PUT error on cache '{}' for key '{}': {}",
                        cache != null ? cache.getName() : "unknown", key, exception.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
                log.warn("Redis EVICT error on cache '{}' for key '{}': {}",
                        cache != null ? cache.getName() : "unknown", key, exception.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException exception, Cache cache) {
                log.warn("Redis CLEAR error on cache '{}': {}",
                        cache != null ? cache.getName() : "unknown", exception.getMessage());
            }
        };
    }
}
