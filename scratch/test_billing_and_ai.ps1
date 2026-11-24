$baseUrl = "http://localhost:8080/api/v1"

# 1. Login as Merchant
$loginMerchant = @{
    identifier = "merchant_demo"
    password = "Password@123"
} | ConvertTo-Json
$resMerchant = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($loginMerchant)) -ContentType "application/json; charset=utf-8"
$merchantToken = $resMerchant.data.accessToken
$merchantHeaders = @{ Authorization = "Bearer $merchantToken" }
$merchantId = $resMerchant.data.userId

# 2. Login as Admin
$loginAdmin = @{
    identifier = "admin_rikkei"
    password = "Password@123"
} | ConvertTo-Json
$resAdmin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($loginAdmin)) -ContentType "application/json; charset=utf-8"
$adminToken = $resAdmin.data.accessToken
$adminHeaders = @{ Authorization = "Bearer $adminToken" }

Write-Host "Creating sample DELIVERED order for COD reconciliation testing..." -ForegroundColor Yellow
$orderBody = @{
    senderName = "Shop Mỹ Phẩm Hà Nội"
    senderPhone = "0912345678"
    senderAddress = "Số 10 Phố Huế, Hoàn Kiếm, Hà Nội"
    senderProvinceId = 1
    receiverName = "Nguyễn Thu Hà"
    receiverPhone = "0987654321"
    receiverAddress = "Số 88 Cầu Giấy, Cầu Giấy, Hà Nội"
    receiverProvinceId = 1
    receiverWardName = "Phường Dịch Vọng Hậu"
    itemName = "Bộ mỹ phẩm dưỡng da cao cấp"
    itemValue = 1500000
    actualWeightGram = 450
    lengthCm = 20
    widthCm = 15
    heightCm = 10
    codAmount = 1500000
    paymentParty = "SENDER"
    serviceType = "STANDARD"
} | ConvertTo-Json

$orderRes = Invoke-RestMethod -Uri "$baseUrl/orders" -Method Post -Headers $merchantHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($orderBody)) -ContentType "application/json; charset=utf-8"
$trackingCode = $orderRes.data.trackingCode
Write-Host "Order created: $trackingCode (COD: 1,500,000 đ, Shipping fee: $($orderRes.data.shippingFee) đ)" -ForegroundColor Green

# 3. Shipper Flow: Pickup -> Inbound -> Scan Delivery -> Complete Delivery
Write-Host "Simulating Shipper delivery flow to transition order to DELIVERED..." -ForegroundColor Yellow

# 3.1. Scan Pickup
$pickupBody = @{ trackingCode = $trackingCode } | ConvertTo-Json
$res1 = Invoke-RestMethod -Uri "$baseUrl/shipper/scan-pickup" -Method Post -Headers $adminHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($pickupBody)) -ContentType "application/json; charset=utf-8"
Write-Host "   -> Scan Pickup OK (Status: $($res1.data.currentStatus))"

# 3.2. Scan Inbound
$inboundBody = @{ trackingCode = $trackingCode; warehouseId = 4 } | ConvertTo-Json
$res2 = Invoke-RestMethod -Uri "$baseUrl/shipper/scan-inbound" -Method Post -Headers $adminHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($inboundBody)) -ContentType "application/json; charset=utf-8"
Write-Host "   -> Scan Inbound OK (Status: $($res2.data.currentStatus))"

# 3.3. Scan Delivery
$deliveryBody = @{ trackingCode = $trackingCode } | ConvertTo-Json
$res3 = Invoke-RestMethod -Uri "$baseUrl/shipper/scan-delivery" -Method Post -Headers $adminHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($deliveryBody)) -ContentType "application/json; charset=utf-8"
Write-Host "   -> Scan Out for Delivery OK (Status: $($res3.data.currentStatus))"

# 3.4. Complete Delivery
$completeBody = @{
    trackingCode = $trackingCode
    podReceiverName = "Nguyễn Thu Hà"
    paymentMethod = "CASH"
    podPhotoUrl = "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500"
} | ConvertTo-Json
$res4 = Invoke-RestMethod -Uri "$baseUrl/shipper/complete-delivery" -Method Post -Headers $adminHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($completeBody)) -ContentType "application/json; charset=utf-8"
Write-Host "   -> Complete Delivery OK! Status: $($res4.data.currentStatus), DeliveredAt: $($res4.data.deliveredAt)" -ForegroundColor Green

# Create reconciliation sheet
$sheetReq = @{
    merchantId = $merchantId
    trackingCodes = @($trackingCode)
} | ConvertTo-Json
$sheetRes = Invoke-RestMethod -Uri "$baseUrl/billing/reconciliations" -Method Post -Headers $adminHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($sheetReq)) -ContentType "application/json; charset=utf-8"
$sheet = $sheetRes.data
Write-Host "Reconciliation Sheet Created: $($sheet.sheetCode)" -ForegroundColor Green
Write-Host "   - Total COD: $($sheet.totalCod) đ"
Write-Host "   - Shipping Fee: -$($sheet.totalShippingFee) đ"
Write-Host "   - Net Payout: $($sheet.netPayout) đ"
Write-Host "   - Status: $($sheet.status)"

# Check Wallet Holding Balance
$w1 = Invoke-RestMethod -Uri "$baseUrl/billing/wallet" -Method Get -Headers $merchantHeaders
Write-Host "Wallet Holding Balance: $($w1.data.holdingCodBalance) đ" -ForegroundColor Green

# Approve & Payout
$apprReq = @{
    bankTransactionCode = "MB-TRANS-" + (Get-Random -Minimum 100000 -Maximum 999999)
} | ConvertTo-Json
$apprRes = Invoke-RestMethod -Uri "$baseUrl/billing/reconciliations/$($sheet.id)/approve" -Method Post -Headers $adminHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($apprReq)) -ContentType "application/json; charset=utf-8"
Write-Host "Reconciliation Approved & Payout Complete! Status: $($apprRes.data.status)" -ForegroundColor Green

# Check Wallet Available Balance
$w2 = Invoke-RestMethod -Uri "$baseUrl/billing/wallet" -Method Get -Headers $merchantHeaders
Write-Host "Wallet Available Balance (After Payout): $($w2.data.availableBalance) đ" -ForegroundColor Green

# Request Withdrawal
$wtdReq = @{
    amount = 500000
    notes = "Rút tiền COD về tài khoản MB"
} | ConvertTo-Json
$wtdRes = Invoke-RestMethod -Uri "$baseUrl/billing/wallet/withdraw" -Method Post -Headers $merchantHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($wtdReq)) -ContentType "application/json; charset=utf-8"
Write-Host "Withdrawal Requested! TxCode: $($wtdRes.data.transactionCode), Amount: -$($wtdRes.data.amount) đ, Balance After: $($wtdRes.data.balanceAfter) đ" -ForegroundColor Green

# Check Transactions
$txs = Invoke-RestMethod -Uri "$baseUrl/billing/wallet/transactions" -Method Get -Headers $merchantHeaders
Write-Host "Transactions in Wallet: $($txs.data.totalElements) transactions recorded." -ForegroundColor Green
foreach ($t in $txs.data.content) {
    Write-Host "   [$($t.transactionType)] $($t.amount) đ | Sau GD: $($t.balanceAfter) đ | $($t.description)"
}

# Test AI Assistant with this tracking code
Write-Host "`nTesting AI CSKH tracking order $trackingCode..." -ForegroundColor Yellow
$chatReq = @{ message = "Cho mình hỏi đơn hàng $trackingCode đang ở đâu và đã giao chưa ạ?" } | ConvertTo-Json
$chatRes = Invoke-RestMethod -Uri "$baseUrl/ai/chat" -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($chatReq)) -ContentType "application/json; charset=utf-8"
Write-Host $chatRes.data.reply -ForegroundColor Cyan
