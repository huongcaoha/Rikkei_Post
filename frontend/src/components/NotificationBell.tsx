import React, { useState, useEffect } from 'react';
import { Badge, Popover, List, Button, Tag, Typography } from 'antd';
import { Bell, CheckCheck, Clock, DollarSign, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationApi, NotificationDTO } from '../api/notification';

const { Text } = Typography;

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000); // Polling 30s
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const res = await notificationApi.getUnreadCount();
      if (res.success) {
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (e) {
      // silent
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.getMyNotifications();
      if (res.success) {
        setNotifications(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      loadNotifications();
      loadUnreadCount();
    }
  };

  const handleItemClick = async (item: NotificationDTO) => {
    if (!item.isRead) {
      try {
        await notificationApi.markAsRead(item.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
      } catch (e) {
        // silent
      }
    }
    setOpen(false);
    if (item.linkUrl) {
      navigate(item.linkUrl);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      // silent
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PAYROLL':
        return <DollarSign size={16} className="text-emerald-500" />;
      case 'VOUCHER':
        return <FileText size={16} className="text-blue-500" />;
      case 'ATTENDANCE':
        return <Clock size={16} className="text-amber-500" />;
      default:
        return <Bell size={16} className="text-gray-500" />;
    }
  };

  const content = (
    <div className="w-80 sm:w-96 max-h-96 flex flex-col">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <span className="font-bold text-gray-800 text-sm">Thông báo hệ thống</span>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CheckCheck size={14} />}
            onClick={handleMarkAllRead}
            className="text-xs p-0 text-red-600 font-semibold"
          >
            Đọc tất cả
          </Button>
        )}
      </div>

      <div className="overflow-y-auto max-h-72 py-1 divide-y divide-gray-50">
        <List
          loading={loading}
          dataSource={notifications}
          locale={{ emptyText: 'Chưa có thông báo nào' }}
          renderItem={(item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`p-2.5 rounded-lg cursor-pointer transition-colors flex gap-2.5 items-start ${
                item.isRead ? 'hover:bg-gray-50' : 'bg-red-50/40 hover:bg-red-50/70'
              }`}
            >
              <div className="mt-0.5 p-1 rounded-md bg-white border border-gray-100 shadow-xs">
                {getTypeIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <Text strong={!item.isRead} className="text-xs text-gray-800 truncate">
                    {item.title}
                  </Text>
                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-red-600 inline-block ml-1"></span>
                  )}
                </div>
                <div className="text-[11px] text-gray-600 line-clamp-2 mt-0.5 leading-tight">
                  {item.content}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
    >
      <div className="cursor-pointer relative flex items-center justify-center p-2 rounded-xl hover:bg-gray-100 transition-colors">
        <Badge count={unreadCount} overflowCount={99} size="small" offset={[2, -2]}>
          <Bell size={20} className="text-gray-600 hover:text-red-600 transition-colors" />
        </Badge>
      </div>
    </Popover>
  );
};
