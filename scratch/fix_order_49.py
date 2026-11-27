import psycopg2

conn = psycopg2.connect('postgresql://rkp_admin:rkp_password_2026@localhost:5433/rkp_logistics')
cur = conn.cursor()

# 1. Update order 49 status
cur.execute("""
    UPDATE orders 
    SET current_status = 'RETURNING',
        assigned_post_office_id = 20,
        delivery_attempts = 3,
        updated_at = '2026-11-27 11:35:00'
    WHERE id = 49
""")

# 2. Update tracking logs for RKP261126926314
cur.execute("""
    UPDATE order_tracking_logs
    SET created_at = '2026-11-27 11:35:00'
    WHERE id = 197
""")

cur.execute("""
    UPDATE order_tracking_logs
    SET location_id = 20,
        location_name = CASE 
            WHEN location_name LIKE '%Cầu Giấy%' THEN 'Kho bưu cục: Bưu Cục Chợ Bến Thành (BC_CHOBENTHANH)'
            ELSE location_name 
        END,
        description = REPLACE(description, 'Bưu cục Cầu Giấy (SPOKE_HN_CG)', 'Bưu Cục Chợ Bến Thành (BC_CHOBENTHANH)')
    WHERE tracking_code = 'RKP261126926314' AND location_id = 4
""")

conn.commit()
print("Fixed order 49 and its tracking logs successfully!")
conn.close()
