import psycopg2

conn = psycopg2.connect('postgresql://rkp_admin:rkp_password_2026@localhost:5433/rkp_logistics')
cur = conn.cursor()
cur.execute("UPDATE orders SET current_status = 'RETURNING' WHERE id = 49")
conn.commit()
print('Updated order 49 to RETURNING successfully!')
conn.close()
