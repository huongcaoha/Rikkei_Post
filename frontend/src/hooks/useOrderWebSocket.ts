import { useEffect } from 'react';
import { notification } from 'antd';
import { webSocketService, OrderEvent } from '../services/websocket';
import { useAuth } from '../context/AuthContext';

interface UseOrderWebSocketOptions {
  onEvent?: (event: OrderEvent) => void;
  showNotification?: boolean;
  topic?: string;
  trackingCode?: string;
  autoSubscribeUserScope?: boolean; // Tự động đăng ký kênh của Bưu cục hoặc Shipper theo user hiện tại
}

export function useOrderWebSocket(options: UseOrderWebSocketOptions = {}) {
  const { user } = useAuth();
  const { onEvent, showNotification = true, topic, trackingCode, autoSubscribeUserScope = true } = options;

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const handleEvent = (event: OrderEvent) => {
      // 1. Hiển thị thông báo Toast nếu bật
      if (showNotification) {
        const isCreated = event.type === 'ORDER_CREATED';
        notification.open({
          message: isCreated ? '🔔 Đơn hàng mới!' : '📦 Cập nhật đơn hàng',
          description: event.message || `Mã vận đơn: #${event.trackingCode} - Trạng thái: ${event.status}`,
          placement: 'topRight',
          duration: 4.5,
        });
      }

      // 2. Kích hoạt callback nếu có
      if (onEvent) {
        onEvent(event);
      }
    };

    // Đăng ký kênh tùy chọn cụ thể
    if (topic) {
      unsubscribes.push(webSocketService.subscribe(topic, handleEvent));
    }

    // Đăng ký kênh tra cứu đơn hàng riêng biệt
    if (trackingCode) {
      unsubscribes.push(webSocketService.subscribe(`/topic/orders/${trackingCode}`, handleEvent));
    }

    // Tự động đăng ký các kênh theo vai trò của người dùng đang đăng nhập
    if (autoSubscribeUserScope && user) {
      // Kênh chung cho toàn hệ thống
      unsubscribes.push(webSocketService.subscribe('/topic/orders', handleEvent));

      // Kênh riêng của bưu cục phụ trách
      if (user.assignedPostOfficeId) {
        unsubscribes.push(webSocketService.subscribe(`/topic/post-office/${user.assignedPostOfficeId}`, handleEvent));
        unsubscribes.push(webSocketService.subscribe(`/topic/warehouse/${user.assignedPostOfficeId}`, handleEvent));
      }

      // Kênh bao tải gom hàng Master Bag
      unsubscribes.push(webSocketService.subscribe('/topic/master-bags', handleEvent));

      // Kênh riêng của shipper
      const isShipper = user.roles?.includes('ROLE_SHIPPER');
      if (isShipper && user.id) {
        unsubscribes.push(webSocketService.subscribe(`/topic/shipper/${user.id}`, handleEvent));
      }

      // Kênh riêng của shop (merchant)
      const isMerchant = user.roles?.includes('ROLE_MERCHANT');
      if (isMerchant && user.id) {
        unsubscribes.push(webSocketService.subscribe(`/topic/merchant/${user.id}`, handleEvent));
      }
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [user?.id, user?.assignedPostOfficeId, topic, trackingCode, autoSubscribeUserScope]);
}
