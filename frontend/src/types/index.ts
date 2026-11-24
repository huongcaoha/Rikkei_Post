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
  latitude: number;
  longitude: number;
  capacityPackages?: number;
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
  podPhotoUrl?: string;
  podSignatureUrl?: string;
  podLatitude?: number;
  podLongitude?: number;
  podReceiverName?: string;
  deliveryOtp?: string;
  rescheduledDeliveryDate?: string;
  failureProofPhotoUrl?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompleteDeliveryRequest {
  trackingCode: string;
  podPhotoUrl?: string;
  podSignatureUrl?: string;
  podLatitude?: number;
  podLongitude?: number;
  receiverName?: string;
  notes?: string;
  otpCode?: string;
  paymentMethod?: 'CASH' | 'VIETQR' | string;
}

export interface DeliveryFailureRequest {
  trackingCode: string;
  reason: string;
  notes?: string;
  failureProofPhotoUrl?: string;
  rescheduledDate?: string;
}

export interface SmartDispatchRequest {
  trackingCode: string;
  shipperId?: number;
  postOfficeId?: number;
}

export interface CashReconciliationResponse {
  shipperId: number;
  shipperName: string;
  shipperPhone: string;
  shiftDate: string;
  totalOrdersDelivered: number;
  totalCodCollected: number;
  totalFeeCollected: number;
  totalCashToSubmit: number;
  orders: Order[];
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
  role?: string;
  roles?: string[];
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
  newPassword?: string;
  role?: string;
  roles?: string[];
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

export interface PricingMatrixItem {
  id: number;
  serviceType: string;
  zoneType: string;
  baseWeightGram: number;
  basePrice: number;
  stepWeightGram: number;
  stepPrice: number;
  estimatedDeliveryHours: number;
  isActive: boolean;
}

export interface PricingMatrixRequest {
  serviceType: string;
  zoneType: string;
  baseWeightGram: number;
  basePrice: number;
  stepWeightGram: number;
  stepPrice: number;
  estimatedDeliveryHours: number;
  isActive?: boolean;
}

export interface PricingPolicy {
  id?: number;
  doorPickupBaseFee: number;
  freePickupOrderThreshold: number;
  bulkyWeightThresholdGram: number;
  bulkyMaxDimensionCm: number;
  bulkySumDimensionsCm: number;
  bulkyExtraPricePerKg: number;
  oversizeDimensionFee: number;
  insuranceValueThreshold: number;
  insurancePercentRate: number;
}

export interface BagItem {
  id: number;
  trackingCode: string;
  weightGram: number;
  itemName?: string;
  receiverAddress?: string;
  routingCode?: string;
  scannedAt: string;
}

export interface MasterBag {
  id: number;
  bagCode: string;
  originWarehouseId: number;
  originWarehouseName: string;
  destWarehouseId: number;
  destWarehouseName: string;
  sealNumber?: string;
  status: 'OPEN' | 'SEALED' | 'MANIFESTED' | 'DISPATCHED' | 'RECEIVED' | 'UNSEALED' | string;
  totalItems: number;
  totalWeightKg: number;
  sealedByUserId?: number;
  sealedByUserName?: string;
  sealedAt?: string;
  manifestId?: number;
  manifestCode?: string;
  notes?: string;
  createdAt: string;
  items?: BagItem[];
}

export interface CreateMasterBagRequest {
  originWarehouseId: number;
  destWarehouseId: number;
  notes?: string;
}

export interface ShipmentManifest {
  id: number;
  manifestCode: string;
  tripCode: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone: string;
  originHubId: number;
  originHubName: string;
  destHubId: number;
  destHubName: string;
  truckSealNumber: string;
  departureScheduledAt: string;
  departureActualAt?: string;
  arrivalEstimatedAt: string;
  arrivalActualAt?: string;
  totalBags: number;
  totalPackages: number;
  status: 'SCHEDULED' | 'LOADING' | 'DISPATCHED' | 'ARRIVED' | 'COMPLETED' | string;
  notes?: string;
  createdAt: string;
  bags?: MasterBag[];
}

export interface CreateManifestRequest {
  tripCode: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone: string;
  originHubId: number;
  destHubId: number;
  truckSealNumber: string;
  departureScheduledAt: string;
  arrivalEstimatedAt: string;
  notes?: string;
  bagCodes?: string[];
}

// ==========================================
// SPRINT 4: BILLING, CARRIER, VRP & AI TYPES
// ==========================================

export interface MerchantWallet {
  id: number;
  merchantId: number;
  merchantName: string;
  availableBalance: number;
  holdingCodBalance: number;
  totalWithdrawn: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  updatedAt: string;
}

export interface ReconciliationSheet {
  id: number;
  sheetCode: string;
  merchantId: number;
  merchantName: string;
  merchantEmail: string;
  startDate: string;
  endDate: string;
  totalOrders: number;
  totalCod: number;
  totalShippingFee: number;
  totalInsuranceFee: number;
  netPayout: number;
  status: 'PENDING' | 'APPROVED' | 'TRANSFERRED' | 'REJECTED' | string;
  paidAt?: string;
  bankTransactionCode?: string;
  createdAt: string;
}

export interface ReconciliationItem {
  id: number;
  orderId: number;
  trackingCode: string;
  receiverName: string;
  codAmount: number;
  shippingFee: number;
  insuranceFee: number;
  netAmount: number;
  deliveredAt?: string;
}

export interface ReconciliationDetail {
  sheet: ReconciliationSheet;
  items: ReconciliationItem[];
}

export interface WalletTransaction {
  id: number;
  merchantId: number;
  transactionCode: string;
  transactionType: 'COD_PAYOUT' | 'FEE_DEDUCTION' | 'WITHDRAWAL' | 'DEPOSIT' | string;
  amount: number;
  balanceAfter: number;
  status: string;
  referenceCode?: string;
  description?: string;
  createdAt: string;
}

export interface CarrierPartner {
  id: number;
  partnerCode: string;
  companyName: string;
  contactPerson?: string;
  contactPhone?: string;
  email?: string;
  vehicleFleetCount: number;
  routesOperated?: string;
  contractPricePerKm: number;
  onTimeDeliveryRate: number;
  slaScore: number;
  status: 'ACTIVE' | 'PAUSED' | 'TERMINATED' | string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CarrierTrip {
  id: number;
  tripCode: string;
  carrierId: number;
  carrierName?: string;
  manifestCode?: string;
  sourceHubId: number;
  sourceHubName?: string;
  destinationHubId: number;
  destinationHubName?: string;
  driverName?: string;
  driverPhone?: string;
  licensePlate?: string;
  distanceKm?: number;
  tripCost?: number;
  departureTime?: string;
  estimatedArrivalTime?: string;
  actualArrivalTime?: string;
  status: 'SCHEDULED' | 'IN_TRANSIT' | 'COMPLETED_ON_TIME' | 'DELAYED' | string;
  slaCompliant?: boolean;
  createdAt: string;
}

export interface VrpStop {
  stopNumber: number;
  trackingCode: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  lat: number;
  lng: number;
  distanceFromPrevKm: number;
  estimatedTravelMinutes: number;
  codAmount: number;
  currentStatus: string;
}

export interface VrpOptimizeResult {
  totalStops: number;
  totalDistanceKm: number;
  totalEstimatedMinutes: number;
  originalDistanceKm: number;
  distanceSavedKm: number;
  savingsPercent: number;
  stops: VrpStop[];
  algorithmUsed: string;
  polylineSummary?: string;
}

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: string;
  detectedIntent?: string;
  suggestions?: string[];
  structuredData?: any;
}




