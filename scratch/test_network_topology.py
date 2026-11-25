import json
import urllib.request
import urllib.error
import sys

BASE_URL = "http://localhost:8080/api/v1"

def login(identifier, password):
    url = f"{BASE_URL}/auth/login"
    payload = json.dumps({"identifier": identifier, "password": password}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["data"]["accessToken"], data["data"]["roles"]
    except urllib.error.HTTPError as e:
        print(f"Login failed for {identifier}: {e.code} - {e.read().decode('utf-8')}")
        return None, []

def get_topology(token):
    url = f"{BASE_URL}/network/topology"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.getcode(), json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, None

def run_tests():
    print("=" * 65)
    print("KIỂM THỬ TÍCH HỢP BẢN ĐỒ MẠNG LƯỚI KHO VẬN (LOGISTICS NETWORK TOPOLOGY)")
    print("=" * 65)

    # 1. Admin Test
    print("\n[1] Kiểm thử tài khoản Quản trị viên (admin_rikkei - ROLE_ADMIN)...")
    admin_token, roles = login("admin_rikkei", "Password@123")
    assert admin_token, "Đăng nhập Admin thất bại!"
    print(f"   => Đăng nhập Admin thành công. Roles: {roles}")

    code, resp = get_topology(admin_token)
    assert code == 200, f"Gọi API thất bại với mã: {code}"
    assert resp["success"] is True, "Phản hồi API success không phải True"
    data = resp["data"]
    
    nodes = data.get("nodes", [])
    links = data.get("links", [])
    trucks = data.get("activeTrucks", [])

    print("\n   => Tổng quan mạng lưới (Topology Counters):")
    print(f"      - Kho vùng miền (Regional Hubs): {data.get('totalRegionalHubs')}")
    print(f"      - Kho Hub tỉnh/thành (Provincial Hubs): {data.get('totalHubs')}")
    print(f"      - Bưu cục chặng cuối (Spoke Offices): {data.get('totalSpokes')}")
    print(f"      - Tổng số liên kết mạng lưới (Network Links): {len(links)}")
    print(f"      - Số xe tải đang hoạt động: {data.get('totalActiveTrucks')}")
    print(f"      - Bao tải đang luân chuyển: {data.get('totalBagsInTransit')}")

    print("\n   => Chi tiết các Nodes phân cấp kho:")
    regional_nodes = [n for n in nodes if n["type"] == "REGIONAL_HUB"]
    hub_nodes = [n for n in nodes if n["type"] == "HUB"]
    spoke_nodes = [n for n in nodes if n["type"] == "SPOKE_POST_OFFICE"]
    print(f"      - Số kho Regional Hub: {len(regional_nodes)}")
    for rn in regional_nodes:
        print(f"        * [{rn['code']}] {rn['name']} ({rn['provinceName']}) - Tọa độ: ({rn['latitude']}, {rn['longitude']}) - Bao chờ: {rn['pendingBagsCount']}")
    print(f"      - Số Hub tỉnh: {len(hub_nodes)}")
    for hn in hub_nodes[:3]:
        print(f"        * [{hn['code']}] {hn['name']} ({hn['provinceName']})")
    print(f"      - Số Bưu cục phát: {len(spoke_nodes)}")
    for sn in spoke_nodes[:3]:
        print(f"        * [{sn['code']}] {sn['name']} ({sn['provinceName']})")

    print("\n   => Chi tiết các đường nối topology (Links):")
    backbone_links = [l for l in links if l["linkType"] == "REGIONAL_BACKBONE"]
    feeder_links = [l for l in links if l["linkType"] == "FEEDER_HUB"]
    spoke_links = [l for l in links if l["linkType"] == "LAST_MILE_SPOKE"]
    print(f"      - Tuyến trục liên miền (REGIONAL_BACKBONE): {len(backbone_links)} đường nối")
    for bl in backbone_links:
        print(f"        * {bl['fromWarehouseName']} <===> {bl['toWarehouseName']} ({bl['distanceKm']} km)")
    print(f"      - Tuyến trung chuyển tỉnh (FEEDER_HUB): {len(feeder_links)} đường nối")
    for fl in feeder_links[:3]:
        print(f"        * {fl['fromWarehouseName']} ---> {fl['toWarehouseName']} ({fl['distanceKm']} km)")
    print(f"      - Tuyến gom bưu cục (LAST_MILE_SPOKE): {len(spoke_links)} đường nối")
    for sl in spoke_links[:3]:
        print(f"        * {sl['fromWarehouseName']} ---> {sl['toWarehouseName']} ({sl['distanceKm']} km)")

    # 2. Branch Manager Test
    print("\n[2] Kiểm thử Quản lý Chi nhánh (branch_hn - ROLE_BRANCH_MANAGER)...")
    bm_token, bm_roles = login("branch_hn", "Password@123")
    assert bm_token, "Đăng nhập branch_hn thất bại!"
    bm_code, bm_resp = get_topology(bm_token)
    assert bm_code == 200, f"branch_hn gọi API bị lỗi mã: {bm_code}"
    print(f"   => branch_hn truy cập thành công! Mã HTTP: {bm_code} (Tổng nodes: {len(bm_resp['data']['nodes'])}, links: {len(bm_resp['data']['links'])})")

    # 3. Post Office Manager Test
    print("\n[3] Kiểm thử Quản lý Bưu cục (manager_cg - ROLE_POST_OFFICE_MANAGER)...")
    pm_token, pm_roles = login("manager_cg", "Password@123")
    assert pm_token, "Đăng nhập manager_cg thất bại!"
    pm_code, pm_resp = get_topology(pm_token)
    assert pm_code == 200, f"manager_cg gọi API bị lỗi mã: {pm_code}"
    print(f"   => manager_cg truy cập thành công! Mã HTTP: {pm_code} (Tổng nodes: {len(pm_resp['data']['nodes'])}, links: {len(pm_resp['data']['links'])})")

    # 4. Shipper Test (Must be Forbidden 403)
    print("\n[4] Kiểm thử phân quyền: Bưu tá (shipper_duytan - ROLE_SHIPPER) KHÔNG ĐƯỢC truy cập...")
    shipper_token, s_roles = login("shipper_duytan", "Password@123")
    assert shipper_token, "Đăng nhập shipper_duytan thất bại!"
    s_code, _ = get_topology(shipper_token)
    assert s_code == 403, f"Bưu tá không bị chặn 403 mà trả về mã: {s_code}"
    print(f"   => Chính xác! Bưu tá bị từ chối truy cập với mã HTTP {s_code} Forbidden.")

    # 5. Merchant Test (Must be Forbidden 403)
    print("\n[5] Kiểm thử phân quyền: Chủ shop (merchant_demo - ROLE_MERCHANT) KHÔNG ĐƯỢC truy cập...")
    merchant_token, m_roles = login("merchant_demo", "Password@123")
    assert merchant_token, "Đăng nhập merchant_demo thất bại!"
    m_code, _ = get_topology(merchant_token)
    assert m_code == 403, f"Chủ shop không bị chặn 403 mà trả về mã: {m_code}"
    print(f"   => Chính xác! Chủ shop bị từ chối truy cập với mã HTTP {m_code} Forbidden.")

    print("\n" + "=" * 65)
    print("TẤT CẢ KIỂM THỬ BẢN ĐỒ MẠNG LƯỚI KHO VẬN (TOPOLOGY) ĐÃ PASS 100%!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
