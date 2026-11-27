import requests

res = requests.post('http://localhost:8080/api/v1/auth/login', json={
    'identifier': 'quanlybuucucchobenthanh',
    'password': 'Password@123'
})
print('Login status:', res.status_code)
if res.status_code == 200:
    token = res.json()['data']['accessToken']
    headers = {'Authorization': f'Bearer {token}'}
    orders_res = requests.get('http://localhost:8080/api/v1/orders/merchant/my-orders', headers=headers)
    print('Orders status:', orders_res.status_code)
    data = orders_res.json()
    orders = data.get('data', {}).get('content', [])
    print(f'Total orders returned: {len(orders)}')
    for o in orders:
        print(f" - Code: {o.get('trackingCode')}, Status: {o.get('currentStatus')}, Receiver: {o.get('receiverName')}, PO: {o.get('postOfficeName')}")
else:
    print('Login failed:', res.text)
