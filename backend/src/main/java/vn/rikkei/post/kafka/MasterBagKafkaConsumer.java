package vn.rikkei.post.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import vn.rikkei.post.dto.kafka.MasterBagTransitKafkaEvent;

@Component
@RequiredArgsConstructor
@Slf4j
public class MasterBagKafkaConsumer {

    private final ObjectMapper objectMapper;
    private final MasterBagTransitProcessor transitProcessor;

    @KafkaListener(topics = MasterBagKafkaProducer.TOPIC_MASTER_BAG_TRANSIT, groupId = "${spring.kafka.consumer.group-id:rkp-logistics-group}")
    public void consumeTransitEvent(String message) {
        log.info("Kafka Consumer: Đã nhận được thông điệp từ topic [{}]: {}", MasterBagKafkaProducer.TOPIC_MASTER_BAG_TRANSIT, message);
        try {
            MasterBagTransitKafkaEvent event = objectMapper.readValue(message, MasterBagTransitKafkaEvent.class);
            transitProcessor.processTransitEvent(event);
            log.info("Kafka Consumer: Đã xử lý thành công sự kiện [{}] cho bao tải [{}]", event.getEventType(), event.getBagCode());
        } catch (Exception e) {
            log.error("Kafka Consumer: Lỗi khi xử lý message từ Kafka: {}", e.getMessage(), e);
        }
    }
}
