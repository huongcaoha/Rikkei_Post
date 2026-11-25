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
  getMyNotifications: async () => {
    const res = await apiClient.get('/notifications');
    return res.data;
  },

  getUnreadCount: async () => {
    const res = await apiClient.get('/notifications/unread-count');
    return res.data;
  },

  markAsRead: async (id: number) => {
    const res = await apiClient.put(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await apiClient.put('/notifications/read-all');
    return res.data;
  },
};
