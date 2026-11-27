import psycopg2

conn = psycopg2.connect('postgresql://rkp_admin:rkp_password_2026@localhost:5433/rkp_logistics')
cur = conn.cursor()
cur.execute("""
    UPDATE users 
    SET password = (SELECT password FROM users WHERE username = 'merchant_demo')
    WHERE username IN ('quanlybuucucchobenthanh', 'shipper_buucuc_chobenthanh')
""")
conn.commit()
print('Updated password for benthanh users!')
conn.close()
