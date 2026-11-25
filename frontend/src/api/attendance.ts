import apiClient from './client';

export interface CheckInRequest {
  lat: number;
  lng: number;
  photoBase64?: string;
  notes?: string;
}

export interface CheckOutRequest {
  lat: number;
  lng: number;
  photoBase64?: string;
  notes?: string;
}

export interface RegisterFaceRequest {
  facePhotoBase64: string;
  faceFeatures?: string;
}

export interface AttendanceRecordDTO {
  id: number;
  userId: number;
  employeeName: string;
  roleName: string;
  warehouseId: number;
  warehouseName: string;
  workDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInPhotoUrl?: string;
  checkOutPhotoUrl?: string;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  distanceFromWarehouseKm?: number;
  isLocationValid?: boolean;
  isFaceMatched?: boolean;
  faceMatchConfidence?: number;
  workHours?: number;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface FaceProfileDTO {
  id?: number;
  userId: number;
  facePhotoUrl?: string;
  isRegistered: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const attendanceApi = {
  checkIn: async (data: CheckInRequest) => {
    const res = await apiClient.post('/attendance/check-in', data);
    return res.data;
  },

  checkOut: async (data: CheckOutRequest) => {
    const res = await apiClient.post('/attendance/check-out', data);
    return res.data;
  },

  getTodayAttendance: async () => {
    const res = await apiClient.get('/attendance/today');
    return res.data;
  },

  getMyAttendanceHistory: async (month?: number, year?: number) => {
    const res = await apiClient.get('/attendance/my-history', { params: { month, year } });
    return res.data;
  },

  getWarehouseAttendance: async (warehouseId: number, date?: string) => {
    const res = await apiClient.get(`/attendance/warehouse/${warehouseId}`, { params: { date } });
    return res.data;
  },

  registerFace: async (data: RegisterFaceRequest) => {
    const res = await apiClient.post('/attendance/face-profile', data);
    return res.data;
  },

  getFaceProfile: async () => {
    const res = await apiClient.get('/attendance/face-profile');
    return res.data;
  },
};
