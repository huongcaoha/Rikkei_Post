import React, { useState, useEffect, useRef } from 'react';
import { Modal, Tabs, Button, message, Tag, Table, Card, Alert, Spin } from 'antd';
import {
  Camera,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { attendanceApi, AttendanceRecordDTO, FaceProfileDTO } from '../api/attendance';
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

  // GPS State
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Camera State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadTodayAttendance();
      loadFaceProfile();
      fetchGpsLocation();
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
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
      const res = await attendanceApi.getTodayAttendance();
      if (res.success) {
        setTodayRecord(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadFaceProfile = async () => {
    try {
      const res = await attendanceApi.getFaceProfile();
      if (res.success) {
        setFaceProfile(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getMyAttendanceHistory();
      if (res.success) {
        setHistory(res.data || []);
      }
    } catch (e: any) {
      message.error('Không thể tải lịch sử chấm công: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGpsLocation = () => {
    setGpsLoading(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt không hỗ trợ định vị GPS!');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError('Không thể lấy tọa độ GPS: ' + err.message + '. Hệ thống sẽ sử dụng tọa độ bưu cục mặc định.');
        // Fallback default coordinates (Hà Nội Hub)
        setCurrentGps({ lat: 21.028511, lng: 105.782352 });
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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

  const handleCheckIn = async () => {
    if (!currentGps) {
      message.warning('Đang xác định tọa độ GPS, vui lòng đợi vài giây!');
      fetchGpsLocation();
      return;
    }

    let photo = capturedPhoto;
    if (!photo && videoRef.current) {
      capturePhoto();
      photo = canvasRef.current?.toDataURL('image/jpeg', 0.85) || null;
    }

    if (!photo) {
      message.warning('Vui lòng chụp ảnh khuôn mặt trước khi Check-in!');
      return;
    }

    setLoading(true);
    try {
      const res = await attendanceApi.checkIn({
        lat: currentGps.lat,
        lng: currentGps.lng,
        photoBase64: photo,
      });
      if (res.success) {
        message.success('🎉 Check-in thành công! ' + (res.data.isLocationValid ? 'Vị trí hợp lệ.' : 'Cảnh báo khoảng cách kho.'));
        setTodayRecord(res.data);
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
      message.warning('Đang xác định tọa độ GPS, vui lòng đợi vài giây!');
      fetchGpsLocation();
      return;
    }

    let photo = capturedPhoto;
    if (!photo && videoRef.current) {
      capturePhoto();
      photo = canvasRef.current?.toDataURL('image/jpeg', 0.85) || null;
    }

    if (!photo) {
      message.warning('Vui lòng chụp ảnh khuôn mặt trước khi Check-out!');
      return;
    }

    setLoading(true);
    try {
      const res = await attendanceApi.checkOut({
        lat: currentGps.lat,
        lng: currentGps.lng,
        photoBase64: photo,
      });
      if (res.success) {
        message.success('🎉 Check-out hoàn tất! Tổng giờ làm hôm nay: ' + res.data.workHours + ' giờ.');
        setTodayRecord(res.data);
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || 'Check-out thất bại!');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterFace = async () => {
    if (!capturedPhoto) {
      message.warning('Vui lòng chụp ảnh khuôn mặt mẫu trước!');
      return;
    }
    setLoading(true);
    try {
      const res = await attendanceApi.registerFace({
        facePhotoBase64: capturedPhoto,
      });
      if (res.success) {
        message.success('Đã cập nhật hồ sơ khuôn mặt FaceID thành công!');
        setFaceProfile(res.data);
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
          <Tag color="orange" className="flex items-center gap-1 w-fit">
            <AlertTriangle size={12} /> {r.distanceFromWarehouseKm}km
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
                      {user?.postOfficeName || 'Bưu cục phụ trách'}
                    </div>
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

                {/* GPS Location Status */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin size={16} className="text-red-500" />
                    <span>
                      Tọa độ hiện tại: <b>{currentGps ? `${currentGps.lat.toFixed(6)}, ${currentGps.lng.toFixed(6)}` : 'Đang tìm...'}</b>
                    </span>
                  </div>
                  <Button
                    size="small"
                    icon={<RefreshCw size={12} className={gpsLoading ? 'animate-spin' : ''} />}
                    onClick={fetchGpsLocation}
                  >
                    Cập nhật GPS
                  </Button>
                </div>

                {gpsError && <Alert type="warning" message={gpsError} showIcon />}

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
                    <Button
                      type="primary"
                      icon={<Camera size={16} />}
                      onClick={capturePhoto}
                      className="absolute bottom-3 bg-red-600 hover:bg-red-700 font-semibold rounded-full px-4 shadow-lg"
                    >
                      Chụp ảnh FaceID
                    </Button>
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
                        <p className="text-xs">Chưa có ảnh chụp. Hãy nhấn "Chụp ảnh FaceID" trên khung hình.</p>
                      </div>
                    )}
                  </div>
                </div>

                <canvas ref={canvasRef} className="hidden" />

                {/* Action Buttons: Check-in & Check-out */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="primary"
                    size="large"
                    disabled={!!todayRecord?.checkInTime || loading}
                    onClick={handleCheckIn}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12 font-bold text-base rounded-xl"
                  >
                    {todayRecord?.checkInTime ? '✓ Đã Check-in hôm nay' : 'Check-in Đi Làm'}
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    disabled={!todayRecord?.checkInTime || !!todayRecord?.checkOutTime || loading}
                    onClick={handleCheckOut}
                    className="flex-1 bg-red-600 hover:bg-red-700 h-12 font-bold text-base rounded-xl"
                  >
                    {todayRecord?.checkOutTime ? '✓ Đã Check-out' : 'Check-out Ra Ca'}
                  </Button>
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
                  message="Đăng ký nhận diện khuôn mặt mẫu (FaceID Profile)"
                  description="Khuôn mặt mẫu sẽ được dùng để đối chiếu xác thực cho mỗi lần bạn Check-in / Check-out, giúp bảo đảm minh bạch và phòng ngừa việc điểm danh hộ."
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
                      <Tag color="green" className="mt-2">Đã kích hoạt FaceID</Tag>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <div className="w-32 h-32 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mx-auto mb-2">
                        <UserCheck size={36} />
                      </div>
                      <span className="text-xs">Chưa có khuôn mặt mẫu</span>
                    </div>
                  )}

                  <div className="space-y-3 max-w-sm">
                    <p className="text-xs text-gray-600">
                      Để cập nhật ảnh mẫu mới: Hãy đứng trước camera ở tab "Chấm công", nhấn "Chụp ảnh FaceID" rồi quay lại đây nhấn "Lưu làm ảnh mẫu".
                    </p>
                    <Button
                      type="primary"
                      onClick={handleRegisterFace}
                      loading={loading}
                      className="bg-blue-600 hover:bg-blue-700 font-semibold rounded-xl"
                    >
                      Lưu ảnh vừa chụp làm ảnh mẫu
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
