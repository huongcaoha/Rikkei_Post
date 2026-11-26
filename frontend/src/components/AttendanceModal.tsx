import React, { useState, useEffect, useRef } from 'react';
import { Modal, Tabs, Button, message, Tag, Table, Card, Alert } from 'antd';
import {
  Camera,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  UserCheck,
  RefreshCw,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { attendanceApi, AttendanceRecordDTO, FaceProfileDTO } from '../api/attendance';
import { locationApi } from '../api/location';
import { Warehouse } from '../types';
import { useAuth } from '../context/AuthContext';

interface AttendanceModalProps {
  open: boolean;
  onClose: () => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({ open, onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('checkin');
  const [loading, setLoading] = useState<boolean>(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecordDTO | null>(null);
  const [history, setHistory] = useState<AttendanceRecordDTO[]>([]);
  const [faceProfile, setFaceProfile] = useState<FaceProfileDTO | null>(null);
  const [assignedWarehouse, setAssignedWarehouse] = useState<Warehouse | null>(null);

  // Kiểm tra hồ sơ FaceID: hỗ trợ cả isRegistered, registered (Jackson) và kiểm tra độ dài chuỗi ảnh facePhotoUrl
  const isFaceRegistered = Boolean(
    faceProfile?.isRegistered ||
    (faceProfile as any)?.registered ||
    (faceProfile?.facePhotoUrl && faceProfile.facePhotoUrl.length > 50)
  );

  // Phân quyền: Kiểm tra xem người dùng có phải là Quản lý (Admin, Branch Manager, Post Office Manager) hay không
  const userRoles = user?.roles || [];
  const isManager = userRoles.some((r: any) => {
    const name = typeof r === 'string' ? r : r.roleName;
    return name === 'ROLE_ADMIN' || name === 'ROLE_BRANCH_MANAGER' || name === 'ROLE_POST_OFFICE_MANAGER';
  });

  // GPS State
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsPermissionState, setGpsPermissionState] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown');
  const watchIdRef = useRef<number | null>(null);

  // Camera State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  useEffect(() => {
    let cameraTimer: any = null;

    if (open) {
      loadTodayAttendance();
      loadFaceProfile();
      loadWarehouseInfo();

      // Kiểm tra trạng thái cấp quyền GPS trước khi gọi
      checkGpsPermission();

      // Trì hoãn mở camera 700ms để tránh giật lag hoặc xung đột với hiệu ứng mở modal
      cameraTimer = setTimeout(() => {
        startCamera();
      }, 700);
    } else {
      stopCamera();
      clearGpsWatch();
    }
    return () => {
      if (cameraTimer) clearTimeout(cameraTimer);
      stopCamera();
      clearGpsWatch();
    };
  }, [open]);

  useEffect(() => {
    if (open && activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, open]);

  const loadTodayAttendance = async () => {
    try {
      const res: any = await attendanceApi.getTodayAttendance();
      const rec = res?.data !== undefined ? res.data : res;
      setTodayRecord(rec || null);
    } catch (e) {
      console.error(e);
    }
  };

  const loadFaceProfile = async () => {
    try {
      const res: any = await attendanceApi.getFaceProfile();
      const prof = res?.data !== undefined ? res.data : res;
      setFaceProfile(prof || null);
    } catch (e) {
      console.error(e);
    }
  };

  const loadWarehouseInfo = async () => {
    try {
      const list = await locationApi.getWarehouses();
      if (Array.isArray(list) && list.length > 0) {
        let wh: Warehouse | undefined;
        if (user?.assignedPostOfficeId) {
          wh = list.find((w) => w.id === user.assignedPostOfficeId);
        }
        if (!wh && user?.postOfficeName) {
          const pName = user.postOfficeName.toLowerCase().trim();
          wh = list.find((w) => w.name.toLowerCase().includes(pName) || pName.includes(w.name.toLowerCase()));
        }
        if (!wh && isManager) {
          wh = list[0];
        }
        setAssignedWarehouse(wh || null);
      }
    } catch (e) {
      console.error('Lỗi nạp thông tin bưu cục:', e);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res: any = await attendanceApi.getMyAttendanceHistory();
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setHistory(list);
    } catch (e: any) {
      message.error('Không thể tải lịch sử chấm công: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // Tính khoảng cách Haversine giữa 2 tọa độ (km)
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Bán kính Trái Đất (km)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  };

  const distanceKm =
    currentGps && assignedWarehouse?.latitude && assignedWarehouse?.longitude
      ? calculateDistanceKm(currentGps.lat, currentGps.lng, assignedWarehouse.latitude, assignedWarehouse.longitude)
      : null;

  // Bán kính hợp lệ tối đa là 0.8 km (800m)
  const isLocationValid = distanceKm !== null ? distanceKm <= 0.8 : false;

  const checkGpsPermission = async () => {
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt của bạn không hỗ trợ định vị GPS!');
      return;
    }
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const p = await navigator.permissions.query({ name: 'geolocation' });
        setGpsPermissionState(p.state);
        if (p.state === 'granted') {
          fetchGpsLocation();
        }
        p.onchange = () => {
          setGpsPermissionState(p.state);
          if (p.state === 'granted') {
            setGpsError(null);
            fetchGpsLocation();
          } else if (p.state === 'denied') {
            setGpsError('PERMISSION_DENIED');
          }
        };
        return;
      } catch (e) {
        console.warn('Lỗi kiểm tra permissions:', e);
      }
    }
    // Fallback: nếu không có permissions query, thử lấy GPS
    setTimeout(() => {
      fetchGpsLocation();
    }, 500);
  };

  const fetchGpsLocation = () => {
    setGpsLoading(true);
    setGpsError(null);
    clearGpsWatch();

    if (!navigator.geolocation) {
      setGpsError('Trình duyệt của bạn không hỗ trợ định vị GPS!');
      setCurrentGps(null);
      setGpsLoading(false);
      return;
    }

    // Tầng 1: Sử dụng vị trí cache gần nhất (maximumAge: 120s) để hiển thị tức thời nếu có
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsLoading(false);
        setGpsError(null);
        setGpsPermissionState('granted');
      },
      (errFast) => {
        console.warn('GPS fast cache không khả dụng, thực hiện định vị mạng/vệ tinh:', errFast);
        // Tầng 2: Gọi định vị qua mạng di động/WiFi
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCurrentGps({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
            setGpsLoading(false);
            setGpsError(null);
            setGpsPermissionState('granted');
          },
          (err) => {
            console.warn('Lỗi định vị GPS:', err);
            setCurrentGps(null);
            setGpsLoading(false);

            if (err.code === 1) {
              setGpsPermissionState('denied');
              setGpsError('PERMISSION_DENIED');
            } else if (err.code === 2) {
              setGpsError('POSITION_UNAVAILABLE');
            } else if (err.code === 3) {
              setGpsError('TIMEOUT');
            } else {
              setGpsError(err.message || 'Không thể xác định vị trí GPS.');
            }
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 }
    );

    // Kích hoạt watchPosition để tự động cập nhật tọa độ chính xác ngay khi điện thoại khóa vệ tinh
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setCurrentGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setGpsLoading(false);
          setGpsError(null);
          setGpsPermissionState('granted');
        },
        () => {},
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
      );
    } catch (e) {
      // ignore
    }
  };

  const clearGpsWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Thiết bị không hỗ trợ getUserMedia');
      setCameraActive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('Không thể mở camera tự động:', err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUri);
        message.success('Đã chụp ảnh khuôn mặt thành công!');
      }
    }
  };

  // Chụp ảnh trực tiếp bằng Camera trước của điện thoại (không qua thư viện ảnh)
  const handleNativeCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setCapturedPhoto(dataUri);
      message.success('Đã chụp ảnh khuôn mặt từ camera điện thoại thành công!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCheckIn = async () => {
    if (!assignedWarehouse) {
      message.error('Tài khoản của bạn chưa được phân công bưu cục công tác! Vui lòng liên hệ Quản lý bưu cục.');
      return;
    }

    if (!currentGps) {
      message.warning('Chưa có tọa độ GPS hợp lệ! Vui lòng bật vị trí và bấm "Cập nhật GPS".');
      fetchGpsLocation();
      return;
    }

    if (!isLocationValid) {
      message.error(
        `Vị trí không hợp lệ! Bạn đang cách bưu cục '${assignedWarehouse.name}' ${distanceKm} km (vượt quá bán kính cho phép 0.8 km). Vui lòng có mặt tại kho để Check-in.`
      );
      return;
    }

    if (!isFaceRegistered) {
      message.error(
        'Tài khoản của bạn chưa được Quản lý bưu cục đăng ký khuôn mặt mẫu FaceID! Vui lòng liên hệ Quản lý bưu cục để được chụp ảnh kích hoạt FaceID.'
      );
      return;
    }

    let photo = capturedPhoto;
    if (!photo && videoRef.current && cameraActive) {
      capturePhoto();
      photo = canvasRef.current?.toDataURL('image/jpeg', 0.85) || null;
    }

    if (!photo) {
      message.warning('Vui lòng chụp ảnh khuôn mặt trước khi Check-in!');
      return;
    }

    setLoading(true);
    try {
      const res: any = await attendanceApi.checkIn({
        lat: currentGps.lat,
        lng: currentGps.lng,
        photoBase64: photo,
      });
      const record = res?.data || res;
      if (record && (record.id || res.success)) {
        message.success(`🎉 Check-in thành công! Bạn đang ở trong bán kính bưu cục (${record.distanceFromWarehouseKm || 0} km).`);
        setTodayRecord(record);
        loadFaceProfile();
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || 'Check-in thất bại!');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!assignedWarehouse) {
      message.error('Tài khoản của bạn chưa được phân công bưu cục công tác! Vui lòng liên hệ Quản lý bưu cục.');
      return;
    }

    if (!currentGps) {
      message.warning('Chưa có tọa độ GPS hợp lệ! Vui lòng bật vị trí và bấm "Cập nhật GPS".');
      fetchGpsLocation();
      return;
    }

    if (!isLocationValid) {
      message.error(
        `Vị trí không hợp lệ! Bạn đang cách bưu cục '${assignedWarehouse.name}' ${distanceKm} km (vượt quá bán kính cho phép 0.8 km). Vui lòng có mặt tại kho để Check-out.`
      );
      return;
    }

    if (!isFaceRegistered) {
      message.error(
        'Tài khoản của bạn chưa được Quản lý bưu cục đăng ký khuôn mặt mẫu FaceID! Vui lòng liên hệ Quản lý bưu cục để được chụp ảnh kích hoạt FaceID.'
      );
      return;
    }

    let photo = capturedPhoto;
    if (!photo && videoRef.current && cameraActive) {
      capturePhoto();
      photo = canvasRef.current?.toDataURL('image/jpeg', 0.85) || null;
    }

    if (!photo) {
      message.warning('Vui lòng chụp ảnh khuôn mặt trước khi Check-out!');
      return;
    }

    setLoading(true);
    try {
      const res: any = await attendanceApi.checkOut({
        lat: currentGps.lat,
        lng: currentGps.lng,
        photoBase64: photo,
      });
      const record = res?.data || res;
      if (record && (record.id || res.success)) {
        message.success(`🎉 Check-out hoàn tất! Tổng giờ làm hôm nay: ${record.workHours ?? ''} giờ.`);
        setTodayRecord(record);
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || 'Check-out thất bại!');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterFace = async () => {
    if (!isManager) {
      message.error('Tài khoản Shipper / Nhân viên kho không được phép tự cập nhật ảnh FaceID! Vui lòng liên hệ Quản lý bưu cục.');
      return;
    }

    if (!capturedPhoto) {
      message.warning('Vui lòng chụp ảnh khuôn mặt mẫu trước khi lưu!');
      return;
    }
    setLoading(true);
    try {
      const res: any = await attendanceApi.registerFace({
        facePhotoBase64: capturedPhoto,
      });
      const profile = res?.data || res;
      if (profile && (profile.userId || res.success)) {
        message.success('Đã đăng ký hồ sơ khuôn mặt FaceID thành công!');
        setFaceProfile(profile);
        setActiveTab('checkin');
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Ngày làm',
      dataIndex: 'workDate',
      key: 'workDate',
      render: (text: string) => <span className="font-semibold">{text}</span>,
    },
    {
      title: 'Giờ vào (Check-in)',
      dataIndex: 'checkInTime',
      key: 'checkInTime',
      render: (t: string) => (t ? t.substring(11, 19) : '-'),
    },
    {
      title: 'Giờ ra (Check-out)',
      dataIndex: 'checkOutTime',
      key: 'checkOutTime',
      render: (t: string) => (t ? t.substring(11, 19) : '-'),
    },
    {
      title: 'Số giờ',
      dataIndex: 'workHours',
      key: 'workHours',
      render: (h: number) => <span className="font-bold text-blue-600">{h ? h + 'h' : '-'}</span>,
    },
    {
      title: 'Vị trí GPS',
      key: 'location',
      render: (_: any, r: AttendanceRecordDTO) =>
        r.isLocationValid ? (
          <Tag color="green" className="flex items-center gap-1 w-fit">
            <CheckCircle2 size={12} /> Hợp lệ ({r.distanceFromWarehouseKm}km)
          </Tag>
        ) : (
          <Tag color="red" className="flex items-center gap-1 w-fit">
            <AlertTriangle size={12} /> {r.distanceFromWarehouseKm}km (Ngoài kho)
          </Tag>
        ),
    },
    {
      title: 'Khuôn mặt FaceID',
      key: 'face',
      render: (_: any, r: AttendanceRecordDTO) =>
        r.isFaceMatched ? (
          <Tag color="blue">{r.faceMatchConfidence}% Khớp</Tag>
        ) : (
          <Tag color="red">Không khớp</Tag>
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => {
        switch (st) {
          case 'COMPLETED':
            return <Tag color="green">Đủ công</Tag>;
          case 'CHECKED_IN':
            return <Tag color="processing">Đang làm việc</Tag>;
          case 'LATE':
            return <Tag color="orange">Đi muộn</Tag>;
          case 'EARLY_LEAVE':
            return <Tag color="volcano">Về sớm</Tag>;
          default:
            return <Tag color="default">{st}</Tag>;
        }
      },
    },
  ];

  const canCheckIn =
    !todayRecord?.checkInTime &&
    currentGps !== null &&
    isLocationValid &&
    capturedPhoto !== null &&
    isFaceRegistered &&
    assignedWarehouse !== null &&
    !loading;

  const canCheckOut =
    todayRecord?.checkInTime &&
    !todayRecord?.checkOutTime &&
    currentGps !== null &&
    isLocationValid &&
    capturedPhoto !== null &&
    isFaceRegistered &&
    assignedWarehouse !== null &&
    !loading;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      title={
        <div className="flex items-center gap-2 text-red-600 font-bold text-lg">
          <Clock size={20} />
          Chấm Công Bưu Cục & Nhận Diện Khuôn Mặt (Smart FaceID & GPS)
        </div>
      }
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'checkin',
            label: (
              <span className="flex items-center gap-1.5 font-medium">
                <Clock size={16} /> Chấm công hôm nay
              </span>
            ),
            children: (
              <div className="space-y-4 py-2">
                {/* Status Card Hôm Nay */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card size="small" className="bg-blue-50 border-blue-200">
                    <div className="text-xs text-gray-500 font-medium">Bưu cục công tác quản lý</div>
                    <div className="text-sm font-bold text-blue-900 mt-0.5 truncate">
                      {assignedWarehouse?.name || user?.postOfficeName || 'Chưa gán bưu cục'}
                    </div>
                    {assignedWarehouse?.latitude && (
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Tọa độ kho: {assignedWarehouse.latitude.toFixed(4)}, {assignedWarehouse.longitude.toFixed(4)}
                      </div>
                    )}
                    {!assignedWarehouse && (
                      <div className="text-[11px] text-red-500 mt-0.5 font-semibold">
                        ⚠️ Bạn chưa được phân công kho làm việc!
                      </div>
                    )}
                  </Card>
                  <Card size="small" className="bg-emerald-50 border-emerald-200">
                    <div className="text-xs text-gray-500 font-medium">Giờ vào (Check-in)</div>
                    <div className="text-sm font-bold text-emerald-800 mt-0.5">
                      {todayRecord?.checkInTime ? todayRecord.checkInTime.substring(11, 19) : 'Chưa check-in'}
                    </div>
                  </Card>
                  <Card size="small" className="bg-amber-50 border-amber-200">
                    <div className="text-xs text-gray-500 font-medium">Giờ ra (Check-out)</div>
                    <div className="text-sm font-bold text-amber-800 mt-0.5">
                      {todayRecord?.checkOutTime ? todayRecord.checkOutTime.substring(11, 19) : 'Chưa check-out'}
                    </div>
                  </Card>
                </div>

                {/* Cảnh báo nếu chưa đăng ký FaceID Profile */}
                {!isFaceRegistered && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<ShieldAlert className="text-amber-500" />}
                    message="Chưa có hồ sơ FaceID chính chủ"
                    description={
                      isManager ? (
                        <div>
                          Bạn chưa đăng ký khuôn mặt mẫu chính chủ. Hệ thống yêu cầu xác thực FaceID trước khi chấm công.{' '}
                          <button
                            className="text-blue-600 underline font-semibold ml-1 cursor-pointer"
                            onClick={() => setActiveTab('profile')}
                          >
                            Bấm vào đây để đăng ký ngay
                          </button>
                        </div>
                      ) : (
                        <div>
                          Tài khoản của bạn chưa được <b>Quản lý bưu cục</b> hoặc <b>Admin</b> chụp ảnh đăng ký FaceID. Để chống điểm danh hộ, nhân viên không thể tự tải ảnh lên. Vui lòng gặp trực tiếp Quản lý bưu cục để được đăng ký ảnh FaceID trước khi chấm công.
                        </div>
                      )
                    }
                  />
                )}

                {/* GPS Location Status Container */}
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin size={16} className="text-red-500 shrink-0" />
                      <div>
                        <span>
                          Tọa độ GPS hiện tại:{' '}
                          <b>
                            {currentGps
                              ? `${currentGps.lat.toFixed(6)}, ${currentGps.lng.toFixed(6)}`
                              : gpsLoading
                              ? 'Đang tìm kiếm vệ tinh GPS...'
                              : 'Chưa xác định'}
                          </b>
                        </span>
                        {distanceKm !== null && assignedWarehouse && (
                          <div className="mt-1">
                            {isLocationValid ? (
                              <Tag color="green" className="font-semibold">
                                ✓ Hợp lệ: Cách bưu cục {distanceKm < 1 ? Math.round(distanceKm * 1000) + 'm' : distanceKm + 'km'} (Trong bán kính 800m)
                              </Tag>
                            ) : (
                              <Tag color="red" className="font-semibold">
                                ✕ Ngoài phạm vi: Cách bưu cục {distanceKm}km (Vượt quá 800m - Bị từ chối)
                              </Tag>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="small"
                      icon={<RefreshCw size={12} className={gpsLoading ? 'animate-spin' : ''} />}
                      onClick={fetchGpsLocation}
                      loading={gpsLoading}
                      className="shrink-0"
                    >
                      Cập nhật GPS
                    </Button>
                  </div>

                  {/* Banner hướng dẫn khi trình duyệt chưa cấp quyền (prompt) */}
                  {gpsPermissionState === 'prompt' && !currentGps && !gpsLoading && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                      <div className="text-blue-900 text-xs">
                        <b>📍 Cần cấp quyền vị trí:</b> Bấm nút bên cạnh và chọn <b>"Cho phép" (Allow)</b> để xác định vị trí chấm công.
                      </div>
                      <Button
                        type="primary"
                        size="small"
                        onClick={fetchGpsLocation}
                        loading={gpsLoading}
                        className="bg-blue-600 shrink-0 ml-2 font-semibold text-xs"
                      >
                        Bật GPS
                      </Button>
                    </div>
                  )}
                </div>

                {/* Hướng dẫn khắc phục chi tiết khi bị lỗi GPS trên điện thoại di động */}
                {(gpsError === 'PERMISSION_DENIED' || gpsPermissionState === 'denied') && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs">
                    <div className="font-bold text-red-700 flex items-center gap-1.5">
                      <XCircle size={16} /> Lỗi cấp quyền vị trí GPS trên trình duyệt điện thoại
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      Trình duyệt trên thiết bị của bạn đang bị chặn quyền Vị trí (Location) hoặc bị chặn bởi lớp phủ ứng dụng (bong bóng chat).
                    </p>
                    <div className="bg-white p-2.5 rounded-lg border border-red-100 space-y-1.5 text-gray-800">
                      <div className="font-semibold text-red-900">3 Bước khắc phục nhanh trên điện thoại:</div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-red-600">1.</span>
                        <span><b>Tắt bong bóng chat:</b> Nếu có bong bóng chat Messenger/Zalo trên màn hình, hãy kéo xuống đáy màn hình để tắt lớp phủ.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-red-600">2.</span>
                        <span><b>Bật lại quyền Vị trí:</b> Nhấn vào biểu tượng <b>Cài đặt trang / Ổ khóa</b> (bên trái thanh địa chỉ <code>https://huongcaoha.site</code>) &rarr; Chọn <b>Quyền (Permissions)</b> &rarr; Bật <b>Vị trí (Location)</b> sang <b>Cho phép (Allow)</b>.</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-red-600">3.</span>
                        <span>Bấm nút <b>"🧭 Thử lại định vị GPS"</b> bên dưới để lấy tọa độ.</span>
                      </div>
                    </div>
                    <Button
                      type="primary"
                      danger
                      size="small"
                      icon={<RefreshCw size={12} className={gpsLoading ? 'animate-spin' : ''} />}
                      onClick={fetchGpsLocation}
                      loading={gpsLoading}
                      className="w-full font-semibold mt-1"
                    >
                      🧭 Thử lại định vị GPS ngay
                    </Button>
                  </div>
                )}

                {gpsError && gpsError !== 'PERMISSION_DENIED' && (
                  <Alert
                    type="warning"
                    message="Thông báo định vị GPS"
                    description={
                      gpsError === 'POSITION_UNAVAILABLE'
                        ? 'Không thể nhận tín hiệu GPS. Vui lòng kiểm tra xem bạn đã bật "Vị trí / GPS" trong Cài đặt điện thoại chưa.'
                        : gpsError === 'TIMEOUT'
                        ? 'Hết thời gian chờ bắt sóng GPS. Vui lòng di chuyển ra khu vực thông thoáng và bấm "Cập nhật GPS".'
                        : gpsError
                    }
                    showIcon
                  />
                )}

                {/* Cảnh báo vị trí quá xa */}
                {currentGps && !isLocationValid && assignedWarehouse && (
                  <Alert
                    type="error"
                    showIcon
                    message="Vị trí không khớp bưu cục quản lý!"
                    description={`Bạn đang ở cách bưu cục '${assignedWarehouse.name}' khoảng ${distanceKm} km. Để bảo đảm tính minh bạch, bạn bắt buộc phải có mặt tại đúng kho bưu cục phụ trách (bán kính tối đa 800m) thì mới có thể Check-in / Check-out.`}
                  />
                )}

                {/* Camera & Capture Container */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Viewfinder Camera */}
                  <div className="relative rounded-2xl overflow-hidden bg-black flex items-center justify-center aspect-4/3 border-2 border-dashed border-gray-300">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-44 h-56 border-2 border-red-500 rounded-full border-dashed opacity-75"></div>
                    </div>
                    {cameraActive && (
                      <Button
                        type="primary"
                        icon={<Camera size={16} />}
                        onClick={capturePhoto}
                        className="absolute bottom-3 bg-red-600 hover:bg-red-700 font-semibold rounded-full px-4 shadow-lg z-10"
                      >
                        Chụp ảnh FaceID
                      </Button>
                    )}

                    {/* Màn hình thông báo / Fallback nếu điện thoại chưa mở Web Camera */}
                    {!cameraActive && (
                      <div className="absolute inset-0 bg-gray-900/90 text-white flex flex-col items-center justify-center p-4 text-center z-20">
                        <Camera size={36} className="text-gray-400 mb-2" />
                        <div className="text-sm font-semibold mb-1">Chưa kích hoạt Web Camera</div>
                        <p className="text-xs text-gray-300 max-w-xs mb-3">
                          Nếu trình duyệt điện thoại báo lỗi lớp phủ hoặc chưa cấp quyền, hãy bấm nút xanh bên dưới để mở Camera điện thoại trực tiếp.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          <Button
                            type="primary"
                            onClick={startCamera}
                            size="small"
                            icon={<Camera size={14} />}
                            className="bg-blue-600"
                          >
                            Thử lại Web Camera
                          </Button>
                          <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-none font-semibold"
                            onClick={() => fileInputRef.current?.click()}
                            size="small"
                            icon={<Smartphone size={14} />}
                          >
                            📱 Mở Camera Điện Thoại
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ảnh vừa chụp & Xem trước */}
                  <div className="rounded-2xl border border-gray-200 p-3 flex flex-col items-center justify-center bg-gray-50 aspect-4/3">
                    {capturedPhoto ? (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <img
                          src={capturedPhoto}
                          alt="Selfie"
                          className="max-h-48 rounded-xl shadow-md object-contain border"
                        />
                        <span className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
                          <CheckCircle2 size={14} /> Ảnh sẵn sàng đối soát khuôn mặt
                        </span>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400">
                        <Camera size={40} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Chưa có ảnh chụp. Hãy đứng trước camera và chụp ảnh khuôn mặt.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tùy chọn chụp ảnh trực tiếp bằng Camera điện thoại (Không cho phép chọn ảnh từ thư viện) */}
                <div className="flex flex-wrap gap-2 items-center justify-center bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                  <span className="text-xs text-gray-500 font-medium">Chụp trực tiếp qua Camera:</span>
                  <Button
                    size="small"
                    icon={<Smartphone size={14} className="text-emerald-600" />}
                    onClick={() => fileInputRef.current?.click()}
                    className="font-medium text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  >
                    📱 Mở Camera điện thoại (Chụp trực tiếp)
                  </Button>
                  {capturedPhoto && (
                    <Button
                      size="small"
                      danger
                      onClick={() => setCapturedPhoto(null)}
                    >
                      Chụp lại
                    </Button>
                  )}
                </div>

                {/* Input native camera ẩn: Bắt buộc capture="user" để chỉ mở Camera trước, KHÔNG mở bộ sưu tập */}
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  ref={fileInputRef}
                  onChange={handleNativeCameraCapture}
                  className="hidden"
                />

                <canvas ref={canvasRef} className="hidden" />

                {/* Action Buttons: Check-in & Check-out */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    type="primary"
                    size="large"
                    disabled={!canCheckIn}
                    onClick={handleCheckIn}
                    loading={loading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500 h-12 font-bold text-base rounded-xl"
                  >
                    {todayRecord?.checkInTime ? '✓ Đã Check-in hôm nay' : 'Check-in Đi Làm'}
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    disabled={!canCheckOut}
                    onClick={handleCheckOut}
                    loading={loading}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 h-12 font-bold text-base rounded-xl"
                  >
                    {todayRecord?.checkOutTime ? '✓ Đã Check-out' : 'Check-out Ra Ca'}
                  </Button>
                </div>

                {/* Chỉ dẫn lý do nếu các nút bị khóa */}
                <div className="text-center text-xs text-gray-500">
                  {!assignedWarehouse ? (
                    <span className="text-red-600 font-semibold">⚠️ Bạn chưa được phân công bưu cục công tác</span>
                  ) : !currentGps ? (
                    <span className="text-amber-600">⚠️ Vui lòng cập nhật tọa độ GPS để mở khóa nút chấm công</span>
                  ) : !isLocationValid ? (
                    <span className="text-red-600">🚫 Bạn đang ở ngoài bán kính 800m của kho nên không thể chấm công</span>
                  ) : !isFaceRegistered ? (
                    <span className="text-amber-600">⚠️ Bạn cần được Quản lý bưu cục đăng ký FaceID trước khi chấm công</span>
                  ) : !capturedPhoto ? (
                    <span className="text-blue-600">📸 Vui lòng chụp ảnh khuôn mặt để hệ thống đối chiếu FaceID</span>
                  ) : null}
                </div>
              </div>
            ),
          },
          {
            key: 'history',
            label: (
              <span className="flex items-center gap-1.5 font-medium">
                <History size={16} /> Lịch sử chấm công tháng này
              </span>
            ),
            children: (
              <div className="py-2">
                <Table
                  dataSource={history}
                  columns={columns}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 7 }}
                  loading={loading}
                />
              </div>
            ),
          },
          {
            key: 'profile',
            label: (
              <span className="flex items-center gap-1.5 font-medium">
                <UserCheck size={16} /> Hồ sơ khuôn mặt mẫu
              </span>
            ),
            children: (
              <div className="py-3 space-y-4">
                <Alert
                  type="info"
                  showIcon
                  icon={<ShieldCheck className="text-blue-600" />}
                  message="Hồ sơ nhận diện khuôn mặt FaceID chính chủ"
                  description="Khuôn mặt mẫu được lưu trữ và đối soát bắt buộc với thuật toán nhận diện khuôn mặt mỗi khi Check-in hoặc Check-out. Điều này đảm bảo tính minh bạch, chính xác và ngăn ngừa tuyệt đối gian lận chấm công hộ."
                />

                <div className="flex flex-col md:flex-row items-center gap-6 justify-center p-4 bg-gray-50 rounded-2xl border">
                  {faceProfile?.facePhotoUrl ? (
                    <div className="text-center">
                      <div className="text-xs text-gray-500 font-semibold mb-2">Ảnh mẫu hiện tại trên hệ thống</div>
                      <img
                        src={faceProfile.facePhotoUrl}
                        alt="Face Profile"
                        className="w-36 h-36 rounded-full object-cover border-4 border-emerald-500 shadow-md mx-auto"
                      />
                      <Tag color="green" className="mt-2 font-medium">
                        ✓ Đã kích hoạt FaceID chính chủ
                      </Tag>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <div className="w-32 h-32 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mx-auto mb-2">
                        <UserCheck size={36} />
                      </div>
                      <span className="text-xs font-semibold text-amber-600">Chưa có khuôn mặt mẫu</span>
                    </div>
                  )}

                  <div className="space-y-3 max-w-sm">
                    {isManager ? (
                      <>
                        <p className="text-xs text-gray-600">
                          <b>Dành cho Quản lý / Admin:</b> Hãy mở camera ở tab "Chấm công hôm nay" và chụp ảnh khuôn mặt chính diện rõ nét, sau đó bấm nút bên dưới để cập nhật ảnh mẫu cho chính mình.
                        </p>
                        {capturedPhoto ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={capturedPhoto}
                              alt="Vừa chụp"
                              className="w-12 h-12 rounded-lg object-cover border"
                            />
                            <span className="text-xs text-emerald-600 font-medium">Đã có ảnh sẵn sàng lưu!</span>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-600">
                            * Bạn chưa chụp ảnh. Vui lòng quay lại tab "Chấm công hôm nay" và chụp ảnh trước.
                          </p>
                        )}
                        <Button
                          type="primary"
                          onClick={handleRegisterFace}
                          loading={loading}
                          disabled={!capturedPhoto}
                          className="bg-blue-600 hover:bg-blue-700 font-semibold rounded-xl w-full"
                        >
                          Lưu ảnh vừa chụp làm ảnh mẫu FaceID
                        </Button>
                      </>
                    ) : (
                      <>
                        {isFaceRegistered ? (
                          <Alert
                            type="success"
                            showIcon
                            message="Hồ sơ FaceID đã được Quản lý bưu cục phê duyệt"
                            description="Ảnh mẫu khuôn mặt của bạn đã được Quản lý bưu cục kích hoạt trên hệ thống. Nhân viên vận hành không được phép tự ý thay đổi ảnh đối soát để đảm bảo tính minh bạch."
                          />
                        ) : (
                          <Alert
                            type="warning"
                            showIcon
                            message="Chưa có hồ sơ FaceID"
                            description="Tài khoản của bạn chưa được Quản lý bưu cục đăng ký khuôn mặt mẫu. Để phòng ngừa gian lận, nhân viên không có quyền tự tải ảnh lên. Vui lòng gặp trực tiếp Quản lý bưu cục để được chụp ảnh kích hoạt FaceID trước khi chấm công."
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};
