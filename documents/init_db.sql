-- =============================================================================
-- RIKKEI_POST LOGISTICS DATABASE INITIALIZATION SCRIPT
-- Project: Rikkei_Post
-- Lead Authors: Nguyễn Công Hưởng & Bùi Thanh Hải
-- Date: 2026-11-20
-- =============================================================================

-- Create databases / schemas if needed
CREATE SCHEMA IF NOT EXISTS auth_schema;
CREATE SCHEMA IF NOT EXISTS order_schema;
CREATE SCHEMA IF NOT EXISTS wms_schema;
CREATE SCHEMA IF NOT EXISTS tms_schema;
CREATE SCHEMA IF NOT EXISTS tracking_schema;
CREATE SCHEMA IF NOT EXISTS billing_schema;
CREATE SCHEMA IF NOT EXISTS ai_optim_schema;

-- =============================================================================
-- 1. AUTH SCHEMA
-- =============================================================================
CREATE TABLE IF NOT EXISTS auth_schema.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('MERCHANT', 'SHIPPER', 'WAREHOUSE_STAFF', 'DISPATCHER', 'ACCOUNTANT', 'ADMIN')),
    assigned_post_office_id BIGINT NULL,
    avatar_url VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON auth_schema.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON auth_schema.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON auth_schema.users(role);

CREATE TABLE IF NOT EXISTS auth_schema.merchant_addresses (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
    contact_name VARCHAR(100) NOT NULL,
    contact_phone VARCHAR(15) NOT NULL,
    province_id INT NOT NULL,
    province_name VARCHAR(100) NOT NULL,
    district_id INT NOT NULL,
    district_name VARCHAR(100) NOT NULL,
    ward_id INT NOT NULL,
    ward_name VARCHAR(100) NOT NULL,
    street_address TEXT NOT NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. ORDER SCHEMA
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_schema.orders (
    id BIGSERIAL PRIMARY KEY,
    tracking_code VARCHAR(30) NOT NULL UNIQUE,
    merchant_id BIGINT NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    sender_phone VARCHAR(15) NOT NULL,
    sender_address TEXT NOT NULL,
    sender_province_id INT NOT NULL,
    sender_district_id INT NOT NULL,
    sender_ward_id INT NOT NULL,
    sender_lat DECIMAL(10, 7) NULL,
    sender_lng DECIMAL(10, 7) NULL,
    receiver_name VARCHAR(100) NOT NULL,
    receiver_phone VARCHAR(15) NOT NULL,
    receiver_address TEXT NOT NULL,
    receiver_province_id INT NOT NULL,
    receiver_district_id INT NOT NULL,
    receiver_ward_id INT NOT NULL,
    receiver_lat DECIMAL(10, 7) NULL,
    receiver_lng DECIMAL(10, 7) NULL,
    item_name VARCHAR(255) NOT NULL,
    item_value DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    actual_weight_gram INT NOT NULL,
    length_cm INT NOT NULL DEFAULT 10,
    width_cm INT NOT NULL DEFAULT 10,
    height_cm INT NOT NULL DEFAULT 10,
    volumetric_weight_gram INT NOT NULL,
    billable_weight_gram INT NOT NULL,
    shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    insurance_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    other_surcharge DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cod_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    payment_party VARCHAR(20) NOT NULL CHECK (payment_party IN ('SENDER', 'RECEIVER')),
    service_type VARCHAR(30) NOT NULL CHECK (service_type IN ('STANDARD', 'EXPRESS', 'ROAD_FREIGHT')),
    routing_code VARCHAR(20) NOT NULL,
    current_status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    delivery_attempts INT NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON order_schema.orders(tracking_code);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON order_schema.orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON order_schema.orders(current_status);

CREATE TABLE IF NOT EXISTS order_schema.pricing_matrix (
    id SERIAL PRIMARY KEY,
    service_type VARCHAR(30) NOT NULL,
    zone_type VARCHAR(30) NOT NULL CHECK (zone_type IN ('INTRA_PROVINCE', 'INTRA_REGION', 'INTER_REGION_NEAR', 'INTER_REGION_FAR')),
    base_weight_gram INT NOT NULL DEFAULT 500,
    base_price DECIMAL(10, 2) NOT NULL,
    step_weight_gram INT NOT NULL DEFAULT 500,
    step_price DECIMAL(10, 2) NOT NULL,
    estimated_delivery_hours INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed pricing initial data
INSERT INTO order_schema.pricing_matrix (service_type, zone_type, base_weight_gram, base_price, step_weight_gram, step_price, estimated_delivery_hours)
VALUES 
('STANDARD', 'INTRA_PROVINCE', 500, 16000.00, 500, 3000.00, 24),
('STANDARD', 'INTRA_REGION', 500, 26000.00, 500, 5000.00, 48),
('STANDARD', 'INTER_REGION_NEAR', 500, 32000.00, 500, 6000.00, 72),
('STANDARD', 'INTER_REGION_FAR', 500, 38000.00, 500, 7000.00, 96),
('EXPRESS', 'INTRA_PROVINCE', 500, 24000.00, 500, 4500.00, 12),
('EXPRESS', 'INTER_REGION_FAR', 500, 49000.00, 500, 9500.00, 24)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. WMS SCHEMA
-- =============================================================================
CREATE TABLE IF NOT EXISTS wms_schema.warehouses (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('HUB', 'SPOKE_POST_OFFICE')),
    province_id INT NOT NULL,
    district_id INT NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    capacity_packages INT NOT NULL DEFAULT 50000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO wms_schema.warehouses (code, name, type, province_id, district_id, address, latitude, longitude)
VALUES
('HUB_HN_NORTH', 'Trung tâm Khai thác Hub Bắc Hà Nội', 'HUB', 1, 1, 'Khu công nghiệp Quang Minh, Mê Linh, Hà Nội', 21.1833, 105.7500),
('HUB_SGN_SOUTH', 'Trung tâm Khai thác Hub Nam Sài Gòn', 'HUB', 79, 760, 'Khu công nghiệp Tân Bình, Tân Phú, TP.HCM', 10.8010, 106.6320),
('SPOKE_HN_HBT', 'Bưu cục Hai Bà Trưng', 'SPOKE_POST_OFFICE', 1, 5, 'Số 15 Phố Đại Cồ Việt, Hai Bà Trưng, Hà Nội', 21.0068, 105.8432),
('SPOKE_HN_CG', 'Bưu cục Cầu Giấy', 'SPOKE_POST_OFFICE', 1, 3, 'Số 21 Phố Duy Tân, Cầu Giấy, Hà Nội', 21.0313, 105.7831)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS wms_schema.master_bags (
    id BIGSERIAL PRIMARY KEY,
    bag_code VARCHAR(30) NOT NULL UNIQUE,
    origin_warehouse_id BIGINT NOT NULL REFERENCES wms_schema.warehouses(id),
    dest_warehouse_id BIGINT NOT NULL REFERENCES wms_schema.warehouses(id),
    seal_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'SEALED', 'MANIFESTED', 'DISPATCHED', 'RECEIVED', 'UNSEALED')),
    total_items INT NOT NULL DEFAULT 0,
    total_weight_kg DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    sealed_by_user_id BIGINT NOT NULL,
    sealed_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wms_schema.bag_items (
    id BIGSERIAL PRIMARY KEY,
    bag_id BIGINT NOT NULL REFERENCES wms_schema.master_bags(id) ON DELETE CASCADE,
    tracking_code VARCHAR(30) NOT NULL,
    weight_gram INT NOT NULL,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 4. TMS SCHEMA
-- =============================================================================
CREATE TABLE IF NOT EXISTS tms_schema.shipment_manifests (
    id BIGSERIAL PRIMARY KEY,
    manifest_code VARCHAR(30) NOT NULL UNIQUE,
    trip_code VARCHAR(30) NOT NULL,
    vehicle_plate VARCHAR(20) NOT NULL,
    driver_name VARCHAR(100) NOT NULL,
    driver_phone VARCHAR(15) NOT NULL,
    origin_hub_id BIGINT NOT NULL,
    dest_hub_id BIGINT NOT NULL,
    truck_seal_number VARCHAR(50) NOT NULL,
    departure_scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    departure_actual_at TIMESTAMP WITH TIME ZONE NULL,
    arrival_estimated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_actual_at TIMESTAMP WITH TIME ZONE NULL,
    total_bags INT NOT NULL DEFAULT 0,
    total_packages INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SCHEDULED', 'LOADING', 'DISPATCHED', 'ARRIVED', 'COMPLETED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_schema.shipper_assignments (
    id BIGSERIAL PRIMARY KEY,
    shipper_id BIGINT NOT NULL,
    tracking_code VARCHAR(30) NOT NULL,
    task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('PICKUP', 'DELIVERY')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sequence_order INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ASSIGNED', 'IN_PROGRESS', 'SUCCESS', 'FAILED')),
    fail_reason VARCHAR(100) NULL,
    pod_photo_url VARCHAR(500) NULL,
    pod_signature_url VARCHAR(500) NULL,
    pod_latitude DECIMAL(10, 7) NULL,
    pod_longitude DECIMAL(10, 7) NULL,
    otp_code VARCHAR(10) NULL,
    completed_at TIMESTAMP WITH TIME ZONE NULL
);

-- =============================================================================
-- 5. TRACKING SCHEMA
-- =============================================================================
CREATE TABLE IF NOT EXISTS tracking_schema.order_tracking_logs (
    id BIGSERIAL PRIMARY KEY,
    tracking_code VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    location_type VARCHAR(30) NOT NULL CHECK (location_type IN ('POST_OFFICE', 'HUB', 'ON_ROAD', 'CONSIGNEE_DOOR')),
    location_id BIGINT NOT NULL,
    location_name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    actor_id BIGINT NOT NULL,
    actor_name VARCHAR(100) NOT NULL,
    gps_lat DECIMAL(10, 7) NULL,
    gps_lng DECIMAL(10, 7) NULL,
    device_info VARCHAR(100) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracking_logs_code ON tracking_schema.order_tracking_logs(tracking_code, created_at DESC);

-- =============================================================================
-- 6. BILLING SCHEMA
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_schema.merchant_wallets (
    id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL UNIQUE,
    available_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0),
    holding_cod_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    total_withdrawn DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    bank_name VARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_account_holder VARCHAR(100) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_schema.reconciliation_sheets (
    id BIGSERIAL PRIMARY KEY,
    sheet_code VARCHAR(30) NOT NULL UNIQUE,
    merchant_id BIGINT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_orders INT NOT NULL,
    total_cod DECIMAL(14, 2) NOT NULL,
    total_shipping_fee DECIMAL(14, 2) NOT NULL,
    total_insurance_fee DECIMAL(14, 2) NOT NULL,
    net_payout DECIMAL(14, 2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'TRANSFERRED', 'REJECTED')),
    paid_at TIMESTAMP WITH TIME ZONE NULL,
    bank_transaction_code VARCHAR(100) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SEED INITIAL MOCK USERS FOR TESTING
-- Passwords: 'Password@123' (BCrypt: $2a$10$wN1FvXhZc5Z6Vq7K... mock)
-- =============================================================================
INSERT INTO auth_schema.users (username, password_hash, full_name, phone_number, email, role)
VALUES 
('merchant_demo', '$2a$10$7R4yL2mU3w9C0.lQ8n7wK.lD7oHj2U8w3P0Z1x4v5n6m7k8j9h0g.', 'Chủ Shop Thời Trang Demo', '0912345678', 'shop_demo@rikkeipost.vn', 'MERCHANT'),
('shipper_hung', '$2a$10$7R4yL2mU3w9C0.lQ8n7wK.lD7oHj2U8w3P0Z1x4v5n6m7k8j9h0g.', 'Bưu tá Nguyễn Công Hưởng', '0988888888', 'shipper_hung@rikkeipost.vn', 'SHIPPER'),
('warehouse_hai', '$2a$10$7R4yL2mU3w9C0.lQ8n7wK.lD7oHj2U8w3P0Z1x4v5n6m7k8j9h0g.', 'Thủ kho Bùi Thanh Hải', '0977777777', 'warehouse_hai@rikkeipost.vn', 'WAREHOUSE_STAFF'),
('admin_rikkei', '$2a$10$7R4yL2mU3w9C0.lQ8n7wK.lD7oHj2U8w3P0Z1x4v5n6m7k8j9h0g.', 'Quản trị viên Hệ thống', '0900000000', 'admin@rikkeipost.vn', 'ADMIN')
ON CONFLICT DO NOTHING;
