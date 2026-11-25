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
  XCircle,
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

  // GPS State
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Camera State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  useEffect(() => {
    let gpsTimer: any = null;
    let cameraTimer: any = null;

    if (open) {
      loadTodayAttendance();
      loadFaceProfile();
      loadWarehouseInfo();

      // Trì hoãn 400ms sau khi modal mở để tránh xung đột hiệu ứng mở cửa sổ với quyền GPS
      gpsTimer = setTimeout(() => {
        fetchGpsLocation();
      }, 400);

      // Trì hoãn 800ms để tránh lỗi tapjacking "Trang web này không thể yêu cầu bạn cấp quyền" trên điện thoại Android/iOS
      cameraTimer = setTimeout(() => {
        startCamera();
      }, 800);
    } else {
      stopCamera();
    }
    return () => {
      if (gpsTimer) clearTimeout(gpsTimer);
      if (cameraTimer) clearTimeout(cameraTimer);
      stopCamera();
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
        if (!wh) {
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

  const fetchGpsLocation = () => {
    setGpsLoading(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt của bạn không hỗ trợ định vị GPS!');
      setCurrentGps(null);
      setGpsLoading(false);
      return;
    }

    // Tầng 1: Lấy tọa độ vệ tinh GPS chính xác cao
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS High Accuracy timeout/error, thử lại qua mạng:', err);
        // Tầng 2: Fallback sang định vị qua sóng di động / Wifi nếu vệ tinh bị timeout
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCurrentGps({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
            setGpsLoading(false);
          },
          (err2) => {
            console.warn('Lỗi định vị tầng 2:', err2);
            setCurrentGps(null);
            setGpsLoading(false);

            if (err2.code === 1) {
              setGpsError(
                '⚠️ Quyền vị trí bị từ chối hoặc bị chặn bởi lớp phủ ứng dụng khác (ví dụ: bong bóng chat Messenger). Vui lòng tạm tắt bong bóng chat, sau đó vào cài đặt trình duyệt cấp quyền Vị trí cho trang web và bấm "Cập nhật GPS".'
              );
            } else if (err2.code === 2) {
              setGpsError(
                '⚠️ Không thể nhận tín hiệu GPS. Vui lòng bật "Dịch vụ định vị" (Location Services) trên điện thoại và bấm "Cập nhật GPS".'
              );
            } else if (err2.code === 3) {
              setGpsError(
                '⚠️ Hết thời gian chờ định vị GPS. Vui lòng di chuyển ra khu vực thông thoáng và bấm "Cập nhật GPS" để thử lại.'
              );
            } else {
              setGpsError('⚠️ Không thể lấy tọa độ GPS: ' + (err2.message || 'Lỗi không xác định. Vui lòng thử lại.'));
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
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
    if (!currentGps) {
      message.warning('Chưa có tọa độ GPS hợp lệ! Vui lòng bật vị trí và bấm "Cập nhật GPS".');
      fetchGpsLocation();
      return;
    }

    if (!isLocationValid) {
      message.error(
        `Vị trí không hợp lệ! Bạn đang cách kho ${distanceKm} km (vượt quá bán kính cho phép 0.8 km). Vui lòng có mặt tại kho để Check-in.`
      );
      return;
    }

    if (!faceProfile?.isRegistered) {
      message.warning('Bạn chưa đăng ký khuôn mặt mẫu FaceID! Vui lòng chuyển sang tab "Hồ sơ khuôn mặt mẫu" để đăng ký trước.');
      setActiveTab('profile');
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
        message.success(`🎉 Check-in thành công! Bạn đang ở trong bán kính kho (${record.distanceFromWarehouseKm || 0} km).`);
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
    if (!currentGps) {
      message.warning('Chưa có tọa độ GPS hợp lệ! Vui lòng bật vị trí và bấm "Cập nhật GPS".');
      fetchGpsLocation();
      return;
    }

    if (!isLocationValid) {
      message.error(
        `Vị trí không hợp lệ! Bạn đang cách kho ${distanceKm} km (vượt quá bán kính cho phép 0.8 km). Vui lòng có mặt tại kho để Check-out.`
      );
      return;
    }

    if (!faceProfile?.isRegistered) {
      message.warning('Bạn chưa đăng ký khuôn mặt mẫu FaceID! Vui lòng chuyển sang tab "Hồ sơ khuôn mặt mẫu" để đăng ký trước.');
      setActiveTab('profile');
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
    faceProfile?.isRegistered &&
    !loading;

  const canCheckOut =
    todayRecord?.checkInTime &&
    !todayRecord?.checkOutTime &&
    currentGps !== null &&
    isLocationValid &&
    capturedPhoto !== null &&
    faceProfile?.isRegistered &&
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
                    <div className="text-xs text-gray-500 font-medium">Bưu cục công tác</div>
                    <div className="text-sm font-bold text-blue-900 mt-0.5 truncate">
                      {assignedWarehouse?.name || user?.postOfficeName || 'Bưu cục phụ trách'}
                    </div>
                    {assignedWarehouse?.latitude && (
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Tọa độ kho: {assignedWarehouse.latitude.toFixed(4)}, {assignedWarehouse.longitude.toFixed(4)}
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
                {!faceProfile?.isRegistered && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<ShieldAlert className="text-amber-500" />}
                    message="Chưa đăng ký hồ sơ khuôn mặt FaceID"
                    description={
                      <div>
                        Bạn chưa đăng ký khuôn mặt mẫu chính chủ. Hệ thống yêu cầu xác thực FaceID trước khi chấm công để chống điểm danh hộ.{' '}
                        <button
                          className="text-blue-600 underline font-semibold ml-1 cursor-pointer"
                          onClick={() => setActiveTab('profile')}
                        >
                          Bấm vào đây để đăng ký ngay
                        </button>
                      </div>
                    }
                  />
                )}

                {/* GPS Location Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs gap-2">
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
                      {distanceKm !== null && (
                        <div className="mt-1">
                          {isLocationValid ? (
                            <Tag color="green" className="font-semibold">
                              ✓ Hợp lệ: Cách kho {distanceKm < 1 ? Math.round(distanceKm * 1000) + 'm' : distanceKm + 'km'} (Trong bán kính 800m)
                            </Tag>
                          ) : (
                            <Tag color="red" className="font-semibold">
                              ✕ Không hợp lệ: Cách kho {distanceKm}km (Vượt quá 800m - Bị từ chối)
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

                {gpsError && (
                  <Alert
                    type="error"
                    message="Lỗi định vị GPS trên thiết bị"
                    description={gpsError}
                    showIcon
                    icon={<XCircle className="text-red-500" />}
                  />
                )}

                {/* Cảnh báo vị trí quá xa */}
                {currentGps && !isLocationValid && (
                  <Alert
                    type="error"
                    showIcon
                    message="Vị trí không khớp bưu cục công tác!"
                    description={`Bạn đang ở cách bưu cục ${assignedWarehouse?.name || ''} khoảng ${distanceKm} km. Để bảo đảm tính minh bạch, bạn bắt buộc phải có mặt tại bưu cục (bán kính tối đa 800m) thì mới có thể Check-in / Check-out.`}
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
                  {!currentGps ? (
                    <span className="text-amber-600">⚠️ Vui lòng cập nhật tọa độ GPS để mở khóa nút chấm công</span>
                  ) : !isLocationValid ? (
                    <span className="text-red-600">🚫 Bạn đang ở ngoài bán kính 800m của kho nên không thể chấm công</span>
                  ) : !faceProfile?.isRegistered ? (
                    <span className="text-amber-600">⚠️ Bạn cần đăng ký khuôn mặt mẫu trước khi chấm công</span>
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
                  message="Đăng ký nhận diện khuôn mặt mẫu chính chủ (FaceID Profile)"
                  description="Khuôn mặt mẫu sẽ được lưu trữ và đối soát với thuật toán nhận diện khuôn mặt mỗi khi bạn Check-in hoặc Check-out. Điều này đảm bảo tính minh bạch, chính xác và ngăn ngừa gian lận chấm công hộ."
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
                    <p className="text-xs text-gray-600">
                      <b>Hướng dẫn đăng ký:</b> Hãy mở camera ở tab "Chấm công hôm nay" và chụp ảnh khuôn mặt chính diện rõ nét, sau đó bấm nút bên dưới để lưu làm ảnh mẫu.
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
