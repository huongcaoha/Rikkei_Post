import { useEffect, useRef } from 'react';
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

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const showNotificationRef = useRef(showNotification);
  useEffect(() => {
    showNotificationRef.current = showNotification;
  }, [showNotification]);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const handleEvent = (event: OrderEvent) => {
      // 1. Hiển thị thông báo Toast nếu bật
      if (showNotificationRef.current) {
        const isMasterBag =
          event.type?.startsWith('MASTER_BAG_') ||
          event.type?.startsWith('BAG_') ||
          Boolean(event.bagCode);

        let title = '📦 Cập nhật đơn hàng';
        let desc = event.message;

        if (isMasterBag) {
          const bagCode = event.bagCode || 'Bao tải';
          const sealInfo = event.sealNumber ? ` (Seal: ${event.sealNumber})` : '';

          switch (event.type) {
            case 'MASTER_BAG_CREATED':
              title = '🎒 Đóng bao tải mới';
              desc = desc || `Bao tải [${bagCode}]${sealInfo} đã được tạo gom kiện.`;
              break;
            case 'BAG_SEALED':
              title = '🔒 Niêm phong kẹp chì bao tải';
              desc = desc || `Bao tải [${bagCode}] đã được kẹp chì ${sealInfo} sẵn sàng luân chuyển.`;
              break;
            case 'BAG_ASSIGNED_TO_DRIVER':
              title = '🚚 Gán bao tải cho tài xế';
              desc = desc || `Bao tải [${bagCode}] đã gán cho tài xế ${event.driverName || 'vận tải'}.`;
              break;
            case 'MASTER_BAG_IN_TRANSIT':
              title = '🚛 Bao tải đang trung chuyển';
              desc = desc || `Bao tải [${bagCode}] đã xuất kho lên xe và đang trên đường luân chuyển.`;
              break;
            case 'MASTER_BAG_ARRIVED_AT_HUB':
              title = '🏢 Tiếp nhận bao tải vào kho Hub';
              desc = desc || `Bao tải [${bagCode}]${sealInfo} đã cập bến và quét nhập kho ${event.hubName || 'Hub'} thành công.`;
              break;
            default:
              title = '🎒 Bao tải gom hàng';
              desc = desc || `Bao tải [${bagCode}] - Trạng thái: ${event.status || 'Cập nhật'}`;
              break;
          }
        } else {
          const isCreated = event.type === 'ORDER_CREATED';
          title = isCreated ? '🔔 Đơn hàng mới!' : '📦 Cập nhật đơn hàng';
          if (!desc) {
            if (event.trackingCode) {
              desc = `Mã vận đơn: #${event.trackingCode} - Trạng thái: ${event.status}`;
            } else {
              desc = `Trạng thái: ${event.status || 'Đã cập nhật'}`;
            }
          }
        }

        // Dùng notification key để Ant Design tự động deduplicate:
        // Cùng 1 sự kiện (dù đến từ nhiều topic như /topic/master-bags và /topic/warehouse/{id}) sẽ chỉ hiện 1 popup duy nhất, không xếp chồng lên nhau
        const notifKey = isMasterBag
          ? `bag_${event.bagCode || 'bag'}_${event.status || event.type}`
          : `order_${event.trackingCode || 'generic'}_${event.status || event.type}`;

        notification.open({
          key: notifKey,
          message: title,
          description: desc,
          placement: 'topRight',
          duration: 4.5,
        });
      }

      // 2. Kích hoạt callback nếu có
      if (onEventRef.current) {
        onEventRef.current(event);
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
