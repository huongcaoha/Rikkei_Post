import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export interface OrderEvent {
  type: 'ORDER_CREATED' | 'ORDER_STATUS_UPDATED' | 'SHIPPER_ASSIGNED';
  trackingCode: string;
  status: string;
  assignedPostOfficeId?: number;
  assignedShipperId?: number;
  assignedShipperName?: string;
  merchantId?: number;
  message: string;
  order?: any;
  previousStatus?: string;
  actorName?: string;
  timestamp: string;
}

type OrderEventCallback = (event: OrderEvent) => void;

class WebSocketService {
  private client: Client | null = null;
  private subscribers: Map<string, Set<OrderEventCallback>> = new Map();
  private isConnecting: boolean = false;

  public init(): void {
    if (this.client || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const wsEndpoint = import.meta.env.VITE_WS_URL || '/ws-logistics';

    this.client = new Client({
      webSocketFactory: () => new SockJS(wsEndpoint),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {
        // Có thể bật debug nếu cần kiểm tra luồng STOMP frames
      },
    });

    this.client.onConnect = () => {
      this.isConnecting = false;
      console.log('[WebSocket] Kết nối STOMP thành công tới Rikkei Post');

      // Tái đăng ký tất cả các topic đang có subscriber
      this.subscribers.forEach((callbacks, topic) => {
        this.client?.subscribe(topic, (message: IMessage) => {
          this.handleIncomingMessage(topic, message);
        });
      });
    };

    this.client.onStompError = (frame) => {
      this.isConnecting = false;
      console.warn('[WebSocket] Lỗi STOMP broker:', frame.headers['message'], frame.body);
    };

    this.client.onWebSocketClose = () => {
      this.isConnecting = false;
    };

    this.client.activate();
  }

  public subscribe(topic: string, callback: OrderEventCallback): () => void {
    this.init();

    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
      if (this.client && this.client.connected) {
        this.client.subscribe(topic, (message: IMessage) => {
          this.handleIncomingMessage(topic, message);
        });
      }
    }

    this.subscribers.get(topic)!.add(callback);

    // Trả về hàm hủy đăng ký (cleanup)
    return () => {
      const cbs = this.subscribers.get(topic);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          this.subscribers.delete(topic);
        }
      }
    };
  }

  private handleIncomingMessage(topic: string, message: IMessage): void {
    try {
      const data: OrderEvent = JSON.parse(message.body);
      const cbs = this.subscribers.get(topic);
      cbs?.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error('[WebSocket] Lỗi xử lý callback sự kiện:', err);
        }
      });
    } catch (e) {
      console.error('[WebSocket] Lỗi phân tích gói tin JSON:', e);
    }
  }

  public isConnected(): boolean {
    return this.client !== null && this.client.connected;
  }
}

export const webSocketService = new WebSocketService();
