import requests

# 1. Check public tracking
res = requests.get('http://localhost:8080/api/v1/orders/track/RKP261126926314')
print('Tracking API status:', res.status_code)
data = res.json().get('data', {})
print('Order status:', data.get('order', {}).get('currentStatus'))
waypoints = data.get('routeWaypoints', [])
print('Total waypoints:', len(waypoints))
for wp in waypoints:
    print(f"  [Trạm {wp.get('index')}] {wp.get('type')}: {wp.get('name')} (Lat: {wp.get('lat')}, Lng: {wp.get('lng')})")

# 2. Check Bưu Cục Chợ Bến Thành login & order view
login_res = requests.post('http://localhost:8080/api/v1/auth/login', json={
    'identifier': 'quanlybuucucchobenthanh',
    'password': 'Password@123'
})
token = login_res.json()['data']['accessToken']
orders_res = requests.get('http://localhost:8080/api/v1/orders/merchant/my-orders', headers={'Authorization': f'Bearer {token}'})
po_orders = orders_res.json().get('data', {}).get('content', [])
found_49 = [o for o in po_orders if o.get('trackingCode') == 'RKP261126926314']
print('Found RKP261126926314 in Bưu Cục Chợ Bến Thành:', len(found_49) > 0)
if found_49:
    print('  Status in PO list:', found_49[0].get('currentStatus'))
    print('  Post Office Name:', found_49[0].get('postOfficeName'))
