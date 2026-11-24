package vn.rikkei.post.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import vn.rikkei.post.dto.kafka.MasterBagTransitKafkaEvent;

@Component
@RequiredArgsConstructor
@Slf4j
public class MasterBagKafkaProducer {

    public static final String TOPIC_MASTER_BAG_TRANSIT = "rkp.master-bag.transit";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final MasterBagTransitProcessor transitProcessor;

    public void sendTransitEvent(MasterBagTransitKafkaEvent event) {
        try {
            String jsonPayload = objectMapper.writeValueAsString(event);
            log.info("Kafka Producer: Đang gửi sự kiện [{}] cho bao tải [{}] tới topic [{}]",
                    event.getEventType(), event.getBagCode(), TOPIC_MASTER_BAG_TRANSIT);

            kafkaTemplate.send(TOPIC_MASTER_BAG_TRANSIT, event.getBagCode(), jsonPayload)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.error("Kafka Producer: Lỗi gửi message qua Kafka broker, kích hoạt xử lý trực tiếp dự phòng: {}", ex.getMessage());
                            transitProcessor.processTransitEvent(event);
                        } else {
                            log.info("Kafka Producer: Gửi thành công tới partition [{}] offset [{}]",
                                    result.getRecordMetadata().partition(),
                                    result.getRecordMetadata().offset());
                        }
                    });
        } catch (Exception e) {
            log.error("Kafka Producer: Ngoại lệ đóng gói JSON sự kiện [{}], thực thi dự phòng ngay: {}",
                    event.getEventType(), e.getMessage());
            transitProcessor.processTransitEvent(event);
        }
    }
}
