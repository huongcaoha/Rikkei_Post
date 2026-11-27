import requests

# 1. Login as shipper_buucuc_chobenthanh
login_res = requests.post('http://localhost:8080/api/v1/auth/login', json={
    'identifier': 'shipper_buucuc_chobenthanh',
    'password': 'Password@123'
})
print('Shipper login status:', login_res.status_code)
if login_res.status_code != 200:
    print('Shipper login failed:', login_res.text)
    exit(1)

token = login_res.json()['data']['accessToken']
headers = {'Authorization': f'Bearer {token}'}

# 2. Test scan-outbound-return (Quét xuất kho lấy đơn chuyển hoàn mang về trả Shop)
scan_res = requests.post(
    'http://localhost:8080/api/v1/shipper/scan-outbound-return',
    json={'trackingCode': 'RKP261126926314'},
    headers=headers
)
print('Scan outbound return status:', scan_res.status_code)
print('Scan outbound return response:', scan_res.json().get('message'))
order_data = scan_res.json().get('data')
if order_data:
    print(f"  Order status: {order_data.get('currentStatus')}")
    print(f"  Assigned Shipper: {order_data.get('assignedShipperName')} ({order_data.get('assignedShipperPhone')})")

# 3. Test complete-return WITHOUT photo (Should fail validation)
fail_res = requests.post(
    'http://localhost:8080/api/v1/shipper/complete-return',
    json={
        'trackingCode': 'RKP261126926314',
        'proofPhotoUrl': '', # Empty photo
        'receiverName': 'Shop Thời Trang Trẻ'
    },
    headers=headers
)
print('Complete return WITHOUT photo status:', fail_res.status_code)
print('Validation message (expected error):', fail_res.json().get('message'))

# 4. Test complete-return WITH photo (Should succeed)
mock_photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...'
success_res = requests.post(
    'http://localhost:8080/api/v1/shipper/complete-return',
    json={
        'trackingCode': 'RKP261126926314',
        'proofPhotoUrl': mock_photo,
        'receiverName': 'Shop Thời Trang Trẻ (Chị Hoa - Quản lý Shop)',
        'notes': 'Kiện hàng còn nguyên tem phong bì niêm phong, Shop đã ký nhận đầy đủ',
        'latitude': 20.972013,
        'longitude': 105.757442
    },
    headers=headers
)
print('Complete return WITH photo status:', success_res.status_code)
print('Complete return response:', success_res.json().get('message'))
ret_data = success_res.json().get('data')
if ret_data:
    print(f"  Final status: {ret_data.get('currentStatus')}")
    print(f"  Delivered/Returned At: {ret_data.get('deliveredAt')}")
    print(f"  POD Receiver Name: {ret_data.get('podReceiverName')}")
    print(f"  Has Photo: {bool(ret_data.get('podPhotoUrl'))}")

# 5. Verify public tracking
track_res = requests.get('http://localhost:8080/api/v1/orders/track/RKP261126926314')
t_data = track_res.json().get('data', {})
print('\n--- PUBLIC TRACKING VERIFICATION ---')
print('Tracking status:', t_data.get('order', {}).get('currentStatus'))
print('Has POD photo in tracking:', bool(t_data.get('order', {}).get('podPhotoUrl')))
latest_log = t_data.get('timeline', [])[0] if t_data.get('timeline') else {}
print('Latest tracking log status:', latest_log.get('status'))
print('Latest tracking log description:', latest_log.get('description'))
