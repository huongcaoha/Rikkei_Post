import psycopg2

conn = psycopg2.connect('postgresql://rkp_admin:rkp_password_2026@localhost:5433/rkp_logistics')
cur = conn.cursor()

cur.execute("""
    SELECT tablename, indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename IN ('orders', 'order_tracking_logs', 'master_bags', 'users')
    ORDER BY tablename, indexname;
""")

for row in cur.fetchall():
    print(f"Table: {row[0]} | Index: {row[1]} | Def: {row[2]}")

conn.close()
