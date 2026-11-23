export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

export interface Role {
  id: number;
  roleName: string;
  description: string;
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  managedProvinceId?: number;
  managedProvinceName?: string;
  assignedPostOfficeId?: number;
  postOfficeName?: string;
  roles: string[];
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  userId: number;
  username: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  managedProvinceId?: number;
  managedProvinceName?: string;
  assignedPostOfficeId?: number;
  postOfficeName?: string;
  roles: string[];
}

export interface Province {
  id: number;
  code: string;
  name: string;
  region: 'NORTH' | 'CENTRAL' | 'SOUTH' | string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface Ward {
  id: number;
  provinceId: number;
  name: string;
  districtName?: string;
  code?: string;
  isActive?: boolean;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: string;
  provinceId: number;
  districtId?: number;
  address: string;
  isActive: boolean;
}

export interface Order {
  id: number;
  trackingCode: string;
  merchantId: number;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  senderProvinceId?: number;
  senderWardName?: string;
  senderLat?: number;
  senderLng?: number;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverProvinceId?: number;
  receiverWardName?: string;
  receiverLat?: number;
  receiverLng?: number;
  itemName: string;
  itemValue: number;
  actualWeightGram: number;
  volumetricWeightGram: number;
  billableWeightGram: number;
  shippingFee: number;
  insuranceFee: number;
  totalFee: number;
  codAmount: number;
  paymentParty: 'SENDER' | 'RECEIVER';
  serviceType: 'STANDARD' | 'EXPRESS' | 'ROAD_FREIGHT';
  pickupType?: 'DROP_OFF' | 'DOOR_PICKUP' | string;
  pickupFee?: number;
  routingCode: string;
  currentStatus: string;
  deliveryAttempts: number;
  notes?: string;
  assignedShipperId?: number;
  assignedShipperName?: string;
  assignedShipperPhone?: string;
  assignedPostOfficeId?: number;
  assignedRouteId?: number;
  pickupCompletedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  senderProvinceId: number;
  senderDistrictId?: number;
  senderWardId?: number;
  senderWardName?: string;
  saveAsDefaultSender?: boolean;
  senderLat?: number;
  senderLng?: number;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverProvinceId: number;
  receiverDistrictId?: number;
  receiverWardId?: number;
  receiverWardName: string;
  receiverLat?: number;
  receiverLng?: number;
  itemName: string;
  itemValue: number;
  actualWeightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  codAmount: number;
  paymentParty: 'SENDER' | 'RECEIVER';
  serviceType: 'STANDARD' | 'EXPRESS' | 'ROAD_FREIGHT';
  pickupType?: 'DROP_OFF' | 'DOOR_PICKUP';
  notes?: string;
}

export interface MerchantAddress {
  id?: number;
  contactName: string;
  contactPhone: string;
  provinceId: number;
  provinceName?: string;
  districtId?: number;
  districtName?: string;
  wardId?: number;
  wardName?: string;
  streetAddress: string;
  isDefault?: boolean;
}

export interface PriceEstimate {
  actualWeightGram: number;
  volumetricWeightGram: number;
  billableWeightGram: number;
  zoneType: string;
  shippingFee: number;
  insuranceFee: number;
  pickupType?: string;
  pickupFee?: number;
  isPickupFree?: boolean;
  pickupFeeNote?: string;
  totalFee: number;
  estimatedDeliveryHours: number;
}

export interface DashboardStats {
  totalOrders: number;
  createdOrders: number;
  inTransitOrders: number;
  deliveringOrders: number;
  deliveredOrders: number;
  failedOrders: number;
  totalCodCollected: number;
  totalShippingFee: number;
  successRate: number;
}

export interface OrderTrackingLog {
  id: number;
  trackingCode: string;
  status: string;
  locationType: string;
  locationId: number;
  locationName: string;
  description: string;
  actorId: number;
  actorName: string;
  deviceInfo?: string;
  createdAt: string;
}

export interface DeliveryRoute {
  id: number;
  routeCode: string;
  routeName: string;
  provinceId: number;
  provinceName?: string;
  districtName?: string;
  wardName?: string;
  postOfficeId?: number;
  postOfficeName?: string;
  assignedShipperId?: number;
  assignedShipperName?: string;
  assignedShipperPhone?: string;
  streetKeywords?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffUser {
  id: number;
  username: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  managedProvinceId?: number;
  managedProvinceName?: string;
  assignedPostOfficeId?: number;
  postOfficeName?: string;
  isActive: boolean;
  roles: string[];
  createdAt?: string;
}

export interface CreateStaffRequest {
  username: string;
  password?: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  role: string;
  managedProvinceId?: number;
  managedProvinceName?: string;
  assignedPostOfficeId?: number;
  postOfficeName?: string;
}

export interface UpdateStaffRequest {
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  password?: string;
  role?: string;
  managedProvinceId?: number;
  managedProvinceName?: string;
  assignedPostOfficeId?: number;
  postOfficeName?: string;
  isActive?: boolean;
}

export interface ShipperSummary {
  totalAssigned: number;
  pickupPending: number;
  pickedUp: number;
  inWarehouse: number;
  delivering: number;
  delivered: number;
  deliveryFailed: number;
  totalCodCollected: number;
  totalFeeCollected?: number;
  totalCollected?: number;
  codOrdersCount?: number;
}

