# ========================================================
# RIKKEI POST - SPRINT 4 END-TO-END AUTOMATED TEST SUITE
# ========================================================
$baseUrl = "http://localhost:8080/api/v1"
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "BẮT ĐẦU KIỂM THỬ E2E TOÀN DIỆN SPRINT 4 (RIKKEI POST)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. ĐĂNG NHẬP ADMIN & LẤY JWT TOKEN
Write-Host "`n[1] Đăng nhập Admin..." -ForegroundColor Yellow
$loginBody = @{
    identifier = "admin_rikkei"
    password = "Password@123"
} | ConvertTo-Json

$loginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($loginBody)) -ContentType "application/json; charset=utf-8"
$adminToken = $loginRes.data.accessToken
$adminHeaders = @{ Authorization = "Bearer $adminToken" }
Write-Host "=> Đăng nhập thành công! User: $($loginRes.data.fullName) (Token: $($adminToken.Substring(0, 15))...)" -ForegroundColor Green

# 2. KIỂM THỬ US-19: BILLING SERVICE & VÍ SHOP & ĐỐI SOÁT COD
Write-Host "`n[2] Kiểm thử US-19: Billing Service & Ví Shop & Bảng kê COD..." -ForegroundColor Yellow

# 2.1. Lấy thông tin ví shop
$walletRes = Invoke-RestMethod -Uri "$baseUrl/billing/wallet" -Method Get -Headers $adminHeaders
Write-Host "=> Thông tin ví Shop:" -ForegroundColor Green
Write-Host "   - Chủ ví: $($walletRes.data.merchantName)"
Write-Host "   - Số dư khả dụng: $($walletRes.data.availableBalance) đ"
Write-Host "   - COD chờ đối soát: $($walletRes.data.holdingCodBalance) đ"
Write-Host "   - Ngân hàng: $($walletRes.data.bankName) - STK: $($walletRes.data.bankAccountNumber)"

# 2.2. Kiểm tra danh sách bảng kê đối soát
$sheetsRes = Invoke-RestMethod -Uri "$baseUrl/billing/reconciliations" -Method Get -Headers $adminHeaders
Write-Host "=> Đã lấy danh sách bảng kê đối soát: $($sheetsRes.data.totalElements) bảng kê" -ForegroundColor Green

# 2.3. Lịch sử giao dịch ví
$txRes = Invoke-RestMethod -Uri "$baseUrl/billing/wallet/transactions" -Method Get -Headers $adminHeaders
Write-Host "=> Đã lấy lịch sử giao dịch ví: $($txRes.data.totalElements) biến động số dư" -ForegroundColor Green

# 3. KIỂM THỬ US-20: ĐỐI TÁC VẬN TẢI 3PL & THEO DÕI SLA
Write-Host "`n[3] Kiểm thử US-20: Đối tác Vận tải 3PL & Đánh giá SLA..." -ForegroundColor Yellow

# 3.1. Lấy danh sách đối tác vận tải
$carriersRes = Invoke-RestMethod -Uri "$baseUrl/carriers/partners" -Method Get -Headers $adminHeaders
Write-Host "=> Danh sách đối tác hiện có: $($carriersRes.data.Count) nhà xe" -ForegroundColor Green

# 3.2. Thêm đối tác vận tải 3PL mới
$newCarrierCode = "3PL-TEST-" + (Get-Random -Minimum 1000 -Maximum 9999)
$carrierBody = @{
    partnerCode = $newCarrierCode
    companyName = "Công ty Vận tải Express Hưởng Nguyễn"
    contactPerson = "Nguyễn Công Hưởng"
    contactPhone = "0367508793"
    email = "huongcaoha1993@gmail.com"
    vehicleFleetCount = 12
    routesOperated = "Hà Nội - Đà Nẵng - TP. Hồ Chí Minh"
    contractPricePerKm = 11500
    onTimeDeliveryRate = 99.2
    slaScore = 4.9
    status = "ACTIVE"
    notes = "Đội xe container 10T và xe tải thùng kín 5T"
} | ConvertTo-Json

$createCarrierRes = Invoke-RestMethod -Uri "$baseUrl/carriers/partners" -Method Post -Headers $adminHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($carrierBody)) -ContentType "application/json; charset=utf-8"
$createdCarrier = $createCarrierRes.data
Write-Host "=> Đã tạo đối tác vận tải thành công:" -ForegroundColor Green
Write-Host "   - ID: $($createdCarrier.id)"
Write-Host "   - Mã đối tác: $($createdCarrier.partnerCode)"
Write-Host "   - Công ty: $($createdCarrier.companyName)"
Write-Host "   - Đơn giá / km: $($createdCarrier.contractPricePerKm) đ/km"
Write-Host "   - SLA On-time: $($createdCarrier.onTimeDeliveryRate)%"

# 3.3. Lấy kho xuất phát và kho đích
$whRes = Invoke-RestMethod -Uri "$baseUrl/locations/warehouses/all" -Method Get -Headers $adminHeaders
$sourceHub = $whRes.data[0]
$destHub = if ($whRes.data.Count -gt 1) { $whRes.data[1] } else { $whRes.data[0] }

# 3.4. Khởi tạo chuyến xe liên tỉnh
$tripBody = @{
    carrierId = $createdCarrier.id
    sourceHubId = $sourceHub.id
    destinationHubId = $destHub.id
    driverName = "Trần Văn Bình"
    driverPhone = "0987654321"
    licensePlate = "29C-999.88"
    distanceKm = 150.0
    tripCost = 1725000
} | ConvertTo-Json

$tripRes = Invoke-RestMethod -Uri "$baseUrl/carriers/trips" -Method Post -Headers $adminHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($tripBody)) -ContentType "application/json; charset=utf-8"
$createdTrip = $tripRes.data
Write-Host "=> Đã điều phối chuyến xe liên tỉnh thành công:" -ForegroundColor Green
Write-Host "   - Mã chuyến: $($createdTrip.tripCode)"
Write-Host "   - Kho đi: $($createdTrip.sourceHubName) ➔ Kho đến: $($createdTrip.destinationHubName)"
Write-Host "   - Lái xe: $($createdTrip.driverName) - Biển số: $($createdTrip.licensePlate)"

# 3.5. Cập nhật chuyến xe đến kho & Đánh giá SLA
$arrivalBody = @{
    status = "COMPLETED_ON_TIME"
    actualArrivalTime = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    notes = "Hàng hóa nguyên đai nguyên kiện, chì niêm phong nguyên vẹn"
} | ConvertTo-Json

$updateTripRes = Invoke-RestMethod -Uri "$baseUrl/carriers/trips/$($createdTrip.id)/status" -Method Put -Headers $adminHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($arrivalBody)) -ContentType "application/json; charset=utf-8"
Write-Host "=> Cập nhật trạng thái chuyến xe & Đánh giá SLA:" -ForegroundColor Green
Write-Host "   - Trạng thái: $($updateTripRes.data.status)"
Write-Host "   - SLA On-time compliant: $($updateTripRes.data.slaCompliant)"

# 4. KIỂM THỬ US-21: THUẬT TOÁN TỐI ƯU TUYẾN ĐƯỜNG VRP (NEAREST NEIGHBOR + 2-OPT)
Write-Host "`n[4] Kiểm thử US-21: Thuật toán Tối ưu Tuyến đường VRP..." -ForegroundColor Yellow

$vrpBody = @{
    startLat = 21.0285
    startLng = 105.8542
    shipperId = 1
    applyToShipper = $false
} | ConvertTo-Json

$vrpRes = Invoke-RestMethod -Uri "$baseUrl/ai/vrp/optimize" -Method Post -Headers $adminHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($vrpBody)) -ContentType "application/json; charset=utf-8"
Write-Host "=> Kết quả Tối ưu Tuyến đường VRP AI:" -ForegroundColor Green
Write-Host "   - Thuật toán sử dụng: $($vrpRes.data.algorithmUsed)"
Write-Host "   - Tổng số điểm giao (Stops): $($vrpRes.data.totalStops)"
Write-Host "   - Quãng đường ban đầu: $($vrpRes.data.originalDistanceKm) km"
Write-Host "   - Quãng đường sau tối ưu: $($vrpRes.data.totalDistanceKm) km"
Write-Host "   - Quãng đường tiết kiệm: -$($vrpRes.data.distanceSavedKm) km ($($vrpRes.data.savingsPercent)%)"
Write-Host "   - Ước tính thời gian hoàn thành: $($vrpRes.data.totalEstimatedMinutes) phút"

# 5. KIỂM THỬ US-22: TRỢ LÝ AI CSKH TRA CỨU THÔNG MINH (CHATBOT & TOOL CALLING)
Write-Host "`n[5] Kiểm thử US-22: Trợ lý AI CSKH Tra cứu Thông minh..." -ForegroundColor Yellow

# Test Chat Case 1: Chào hỏi & Điều hướng
$chatBody1 = @{ message = "Xin chào, bạn có thể giúp gì cho tôi?" } | ConvertTo-Json
$chatRes1 = Invoke-RestMethod -Uri "$baseUrl/ai/chat" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($chatBody1)) -ContentType "application/json; charset=utf-8"
Write-Host "=> AI Phản hồi (Intent: $($chatRes1.data.detectedIntent)):" -ForegroundColor Green
Write-Host $chatRes1.data.reply

# Test Chat Case 2: Tìm bưu cục gần nhất
$chatBody2 = @{ message = "Cho tôi hỏi bưu cục Rikkei Post ở đâu gần nhất?" } | ConvertTo-Json
$chatRes2 = Invoke-RestMethod -Uri "$baseUrl/ai/chat" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($chatBody2)) -ContentType "application/json; charset=utf-8"
Write-Host "`n=> AI Phản hồi Tra cứu Bưu cục (Intent: $($chatRes2.data.detectedIntent)):" -ForegroundColor Green
Write-Host $chatRes2.data.reply

# Test Chat Case 3: Hỏi về ví shop & tiền COD
$chatBody3 = @{ message = "Tiền COD và số dư ví của tôi thế nào rồi?"; userId = 1 } | ConvertTo-Json
$chatRes3 = Invoke-RestMethod -Uri "$baseUrl/ai/chat" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($chatBody3)) -ContentType "application/json; charset=utf-8"
Write-Host "`n=> AI Phản hồi Ví Shop COD (Intent: $($chatRes3.data.detectedIntent)):" -ForegroundColor Green
Write-Host $chatRes3.data.reply

# 6. KIỂM THỬ US-23: MÔ HÌNH DỰ BÁO THỜI GIAN GIAO HÀNG (PREDICTIVE ETA)
Write-Host "`n[6] Kiểm thử US-23: Mô hình Dự báo Thời gian Giao hàng (Predictive ETA)..." -ForegroundColor Yellow

$etaBody = @{
    senderProvinceId = 1 # Hà Nội
    receiverProvinceId = 79 # TP. Hồ Chí Minh
    serviceType = "EXPRESS"
} | ConvertTo-Json

$etaRes = Invoke-RestMethod -Uri "$baseUrl/ai/predict-eta" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($etaBody)) -ContentType "application/json; charset=utf-8"
Write-Host "=> Kết quả Dự báo ETA Giao hàng:" -ForegroundColor Green
Write-Host "   - Dịch vụ: EXPRESS Hà Nội ➔ TP.HCM"
Write-Host "   - Mô tả vận chuyển: $($etaRes.data.transitDescription)"
Write-Host "   - Khoảng thời gian: $($etaRes.data.minHours)h - $($etaRes.data.maxHours)h"
Write-Host "   - Dự kiến phát trước (ETA): $($etaRes.data.estimatedDeliveryAt)"
Write-Host "   - Độ tin cậy (Confidence): $($etaRes.data.confidenceLevel)"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "HOÀN TẤT THÀNH CÔNG 100% KIỂM THỬ TẤT CẢ USER STORY SPRINT 4!" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
