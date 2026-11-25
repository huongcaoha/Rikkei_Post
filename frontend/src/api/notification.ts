import apiClient from './client';

export interface NotificationDTO {
  id: number;
  userId: number;
  title: string;
  content: string;
  type: 'PAYROLL' | 'VOUCHER' | 'ATTENDANCE' | 'ORDER' | 'SYSTEM';
  isRead: boolean;
  linkUrl?: string;
  createdAt: string;
}

export const notificationApi = {
  getMyNotifications: async (): Promise<NotificationDTO[]> => {
    const res = await apiClient.get('/notifications');
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return Array.isArray(d) ? d : [];
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await apiClient.get('/notifications/unread-count');
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return typeof d === 'number' ? d : (d?.count || 0);
  },

  markAsRead: async (id: number) => {
    const res = await apiClient.put(`/notifications/${id}/read`);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  markAllAsRead: async () => {
    const res = await apiClient.put('/notifications/read-all');
    return res.data?.data !== undefined ? res.data.data : res.data;
  },
};
