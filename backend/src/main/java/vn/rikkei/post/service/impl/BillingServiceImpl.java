package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.billing.*;
import vn.rikkei.post.entity.*;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.service.BillingService;
import vn.rikkei.post.service.EmailService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillingServiceImpl implements BillingService {

    private final MerchantWalletRepository walletRepository;
    private final ReconciliationSheetRepository sheetRepository;
    private final ReconciliationItemRepository itemRepository;
    private final WalletTransactionRepository transactionRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    @Override
    @Transactional
    public WalletResponse getMerchantWallet(Long merchantId) {
        MerchantWallet wallet = getOrCreateWallet(merchantId);
        User merchant = userRepository.findById(merchantId).orElse(null);
        return mapToWalletResponse(wallet, merchant != null ? merchant.getFullName() : "");
    }

    @Override
    @Transactional
    public WalletResponse updateWalletBank(Long merchantId, String bankName, String bankAccountNumber, String bankAccountHolder) {
        MerchantWallet wallet = getOrCreateWallet(merchantId);
        wallet.setBankName(bankName);
        wallet.setBankAccountNumber(bankAccountNumber);
        wallet.setBankAccountHolder(bankAccountHolder);
        MerchantWallet saved = walletRepository.save(wallet);

        User merchant = userRepository.findById(merchantId).orElse(null);
        return mapToWalletResponse(saved, merchant != null ? merchant.getFullName() : "");
    }

    @Override
    @Transactional
    public ReconciliationSheetResponse createReconciliationSheet(CreateReconciliationRequest request, Long currentUserId) {
        Long targetMerchantId = request.getMerchantId() != null ? request.getMerchantId() : currentUserId;
        if (targetMerchantId == null) {
            throw new IllegalArgumentException("Không xác định được Shop / Merchant cần đối soát!");
        }

        User merchant = userRepository.findById(targetMerchantId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy Shop ID: " + targetMerchantId));

        // Lấy các đơn hàng DELIVERED chưa đối soát
        List<Order> eligibleOrders;
        if (request.getTrackingCodes() != null && !request.getTrackingCodes().isEmpty()) {
            eligibleOrders = orderRepository.findByTrackingCodeIn(request.getTrackingCodes()).stream()
                    .filter(o -> targetMerchantId.equals(o.getMerchantId()))
                    .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus()))
                    .filter(o -> !Boolean.TRUE.equals(o.getIsReconciled()))
                    .collect(Collectors.toList());
        } else {
            eligibleOrders = orderRepository.findByMerchantIdAndCurrentStatusAndIsReconciledFalse(targetMerchantId, "DELIVERED");
        }

        if (eligibleOrders.isEmpty()) {
            throw new IllegalStateException("Không có đơn hàng 'Giao thành công' nào chưa đối soát để tạo bảng kê!");
        }

        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now().minusDays(7);
        LocalDate endDate = request.getEndDate() != null ? request.getEndDate() : LocalDate.now();

        // Tạo mã bảng kê: REC-YYYYMMDD-XXXX
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomSuffix = String.format("%04d", new Random().nextInt(10000));
        String sheetCode = "REC-" + datePart + "-" + randomSuffix;

        BigDecimal totalCod = BigDecimal.ZERO;
        BigDecimal totalShippingFee = BigDecimal.ZERO;
        BigDecimal totalInsuranceFee = BigDecimal.ZERO;

        for (Order o : eligibleOrders) {
            if (o.getCodAmount() != null) totalCod = totalCod.add(o.getCodAmount());
            if (o.getShippingFee() != null) totalShippingFee = totalShippingFee.add(o.getShippingFee());
            if (o.getInsuranceFee() != null) totalInsuranceFee = totalInsuranceFee.add(o.getInsuranceFee());
        }

        BigDecimal netPayout = totalCod.subtract(totalShippingFee).subtract(totalInsuranceFee);

        ReconciliationSheet sheet = ReconciliationSheet.builder()
                .sheetCode(sheetCode)
                .merchantId(targetMerchantId)
                .startDate(startDate)
                .endDate(endDate)
                .totalOrders(eligibleOrders.size())
                .totalCod(totalCod)
                .totalShippingFee(totalShippingFee)
                .totalInsuranceFee(totalInsuranceFee)
                .netPayout(netPayout)
                .status("PENDING")
                .build();

        ReconciliationSheet savedSheet = sheetRepository.save(sheet);

        // Lưu từng item và cập nhật Order
        List<ReconciliationItem> items = new ArrayList<>();
        for (Order o : eligibleOrders) {
            BigDecimal cod = o.getCodAmount() != null ? o.getCodAmount() : BigDecimal.ZERO;
            BigDecimal ship = o.getShippingFee() != null ? o.getShippingFee() : BigDecimal.ZERO;
            BigDecimal ins = o.getInsuranceFee() != null ? o.getInsuranceFee() : BigDecimal.ZERO;
            BigDecimal net = cod.subtract(ship).subtract(ins);

            ReconciliationItem item = ReconciliationItem.builder()
                    .sheetId(savedSheet.getId())
                    .orderId(o.getId())
                    .trackingCode(o.getTrackingCode())
                    .receiverName(o.getReceiverName())
                    .codAmount(cod)
                    .shippingFee(ship)
                    .insuranceFee(ins)
                    .netAmount(net)
                    .deliveredAt(o.getDeliveredAt())
                    .build();
            items.add(item);

            // Cập nhật Order đã vào bảng kê
            o.setIsReconciled(true);
            o.setReconciliationSheetCode(sheetCode);
            orderRepository.save(o);
        }
        itemRepository.saveAll(items);

        // Cập nhật ví merchant (tiền đang chờ đối soát)
        MerchantWallet wallet = getOrCreateWallet(targetMerchantId);
        wallet.setHoldingCodBalance(wallet.getHoldingCodBalance().add(netPayout));
        walletRepository.save(wallet);

        log.info("Đã tạo Bảng kê Đối soát COD #{}: {} đơn hàng, Net Payout: {} đ", sheetCode, eligibleOrders.size(), netPayout);
        return mapToSheetResponse(savedSheet, merchant);
    }

    @Override
    @Transactional(readOnly = true)
    public ReconciliationDetailResponse getSheetDetail(Long sheetId) {
        ReconciliationSheet sheet = sheetRepository.findById(sheetId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê với ID: " + sheetId));
        return buildSheetDetail(sheet);
    }

    @Override
    @Transactional(readOnly = true)
    public ReconciliationDetailResponse getSheetDetailByCode(String sheetCode) {
        ReconciliationSheet sheet = sheetRepository.findBySheetCode(sheetCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê với mã: " + sheetCode));
        return buildSheetDetail(sheet);
    }

    private ReconciliationDetailResponse buildSheetDetail(ReconciliationSheet sheet) {
        User merchant = userRepository.findById(sheet.getMerchantId()).orElse(null);
        ReconciliationSheetResponse sheetRes = mapToSheetResponse(sheet, merchant);

        List<ReconciliationItemDto> items = itemRepository.findBySheetIdOrderByIdAsc(sheet.getId()).stream()
                .map(i -> ReconciliationItemDto.builder()
                        .id(i.getId())
                        .orderId(i.getOrderId())
                        .trackingCode(i.getTrackingCode())
                        .receiverName(i.getReceiverName())
                        .codAmount(i.getCodAmount())
                        .shippingFee(i.getShippingFee())
                        .insuranceFee(i.getInsuranceFee())
                        .netAmount(i.getNetAmount())
                        .deliveredAt(i.getDeliveredAt())
                        .build())
                .collect(Collectors.toList());

        return ReconciliationDetailResponse.builder()
                .sheet(sheetRes)
                .items(items)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ReconciliationSheetResponse> getReconciliationSheets(Long merchantId, String status, Pageable pageable) {
        Page<ReconciliationSheet> sheets;
        boolean hasStatus = status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status);

        if (merchantId != null) {
            if (hasStatus) {
                sheets = sheetRepository.findByMerchantIdAndStatusOrderByCreatedAtDesc(merchantId, status, pageable);
            } else {
                sheets = sheetRepository.findByMerchantIdOrderByCreatedAtDesc(merchantId, pageable);
            }
        } else {
            if (hasStatus) {
                sheets = sheetRepository.findByStatusOrderByCreatedAtDesc(status, pageable);
            } else {
                sheets = sheetRepository.findAll(pageable);
            }
        }

        Map<Long, User> userCache = new HashMap<>();
        List<ReconciliationSheetResponse> dtoList = sheets.getContent().stream().map(s -> {
            User m = userCache.computeIfAbsent(s.getMerchantId(), id -> userRepository.findById(id).orElse(null));
            return mapToSheetResponse(s, m);
        }).collect(Collectors.toList());

        return new PageImpl<>(dtoList, pageable, sheets.getTotalElements());
    }

    @Override
    @Transactional
    public ReconciliationSheetResponse approveAndPayout(Long sheetId, ApprovePayoutRequest request, Long currentUserId) {
        ReconciliationSheet sheet = sheetRepository.findById(sheetId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê với ID: " + sheetId));

        if (!"PENDING".equalsIgnoreCase(sheet.getStatus())) {
            throw new IllegalStateException("Bảng kê này đã được duyệt hoặc hoàn tất thanh toán trước đó (trạng thái: " + sheet.getStatus() + ")!");
        }

        sheet.setStatus("TRANSFERRED");
        sheet.setPaidAt(LocalDateTime.now());
        sheet.setBankTransactionCode(request != null && request.getBankTransactionCode() != null ? request.getBankTransactionCode() : "TX-" + System.currentTimeMillis());
        ReconciliationSheet savedSheet = sheetRepository.save(sheet);

        // Cập nhật số dư Ví Shop: chuyển từ holdingCod sang availableBalance
        MerchantWallet wallet = getOrCreateWallet(sheet.getMerchantId());
        BigDecimal net = sheet.getNetPayout();

        wallet.setHoldingCodBalance(wallet.getHoldingCodBalance().subtract(net).max(BigDecimal.ZERO));
        wallet.setAvailableBalance(wallet.getAvailableBalance().add(net));
        walletRepository.save(wallet);

        // Tạo WalletTransaction
        String txCode = "TX-PAY-" + System.currentTimeMillis();
        WalletTransaction tx = WalletTransaction.builder()
                .merchantId(sheet.getMerchantId())
                .walletId(wallet.getId())
                .transactionCode(txCode)
                .transactionType("COD_PAYOUT")
                .amount(net)
                .balanceAfter(wallet.getAvailableBalance())
                .status("COMPLETED")
                .referenceCode(sheet.getSheetCode())
                .description("Quyết toán tiền COD & Doanh thu theo bảng kê: " + sheet.getSheetCode())
                .build();
        transactionRepository.save(tx);

        User merchant = userRepository.findById(sheet.getMerchantId()).orElse(null);

        // Gửi email thông báo quyết toán thành công
        if (merchant != null && merchant.getEmail() != null && !merchant.getEmail().isBlank()) {
            try {
                emailService.sendCodReconciliationEmail(merchant.getEmail(), sheet.getSheetCode(), net.doubleValue(), null);
            } catch (Exception e) {
                log.warn("Lỗi khi gửi email quyết toán COD: {}", e.getMessage());
            }
        }

        log.info("Duyệt chi trả COD thành công cho Bảng kê #{}, cộng ví: {} đ", sheet.getSheetCode(), net);
        return mapToSheetResponse(savedSheet, merchant);
    }

    @Override
    @Transactional
    public WalletTransactionResponse requestWithdrawal(WithdrawalRequest request, Long merchantId) {
        MerchantWallet wallet = getOrCreateWallet(merchantId);

        if (wallet.getAvailableBalance().compareTo(request.getAmount()) < 0) {
            throw new IllegalArgumentException("Số dư khả dụng không đủ để rút tiền! Số dư hiện tại: " + wallet.getAvailableBalance() + " đ");
        }

        wallet.setAvailableBalance(wallet.getAvailableBalance().subtract(request.getAmount()));
        wallet.setTotalWithdrawn(wallet.getTotalWithdrawn().add(request.getAmount()));
        walletRepository.save(wallet);

        String txCode = "TX-WTD-" + System.currentTimeMillis();
        WalletTransaction tx = WalletTransaction.builder()
                .merchantId(merchantId)
                .walletId(wallet.getId())
                .transactionCode(txCode)
                .transactionType("WITHDRAWAL")
                .amount(request.getAmount())
                .balanceAfter(wallet.getAvailableBalance())
                .status("COMPLETED")
                .referenceCode(request.getBankAccountNumber() != null ? request.getBankAccountNumber() : wallet.getBankAccountNumber())
                .description("Rút tiền về tài khoản ngân hàng " + (request.getBankName() != null ? request.getBankName() : wallet.getBankName())
                        + " - STK: " + (request.getBankAccountNumber() != null ? request.getBankAccountNumber() : wallet.getBankAccountNumber()))
                .build();

        WalletTransaction savedTx = transactionRepository.save(tx);
        return mapToTransactionResponse(savedTx);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<WalletTransactionResponse> getWalletTransactions(Long merchantId, Pageable pageable) {
        Page<WalletTransaction> page;
        if (merchantId != null) {
            page = transactionRepository.findByMerchantIdOrderByCreatedAtDesc(merchantId, pageable);
        } else {
            page = transactionRepository.findAll(pageable);
        }
        List<WalletTransactionResponse> list = page.getContent().stream()
                .map(this::mapToTransactionResponse)
                .collect(Collectors.toList());
        return new PageImpl<>(list, pageable, page.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public String exportReconciliationCsv(Long sheetId) {
        ReconciliationSheet sheet = sheetRepository.findById(sheetId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê ID: " + sheetId));
        List<ReconciliationItem> items = itemRepository.findBySheetIdOrderByIdAsc(sheetId);

        StringBuilder sb = new StringBuilder();
        sb.append("STT,Mã đơn hàng,Người nhận,Tiền COD,Cước phí gửi,Phí bảo hiểm,Thực nhận (Net)\n");
        int idx = 1;
        for (ReconciliationItem item : items) {
            sb.append(idx++).append(",")
                    .append(item.getTrackingCode()).append(",")
                    .append("\"").append(item.getReceiverName() != null ? item.getReceiverName() : "").append("\",")
                    .append(item.getCodAmount()).append(",")
                    .append(item.getShippingFee()).append(",")
                    .append(item.getInsuranceFee()).append(",")
                    .append(item.getNetAmount()).append("\n");
        }
        sb.append("\n");
        sb.append("Tổng cộng,,,")
                .append(sheet.getTotalCod()).append(",")
                .append(sheet.getTotalShippingFee()).append(",")
                .append(sheet.getTotalInsuranceFee()).append(",")
                .append(sheet.getNetPayout()).append("\n");

        return sb.toString();
    }

    private MerchantWallet getOrCreateWallet(Long merchantId) {
        return walletRepository.findByMerchantId(merchantId).orElseGet(() -> {
            MerchantWallet newWallet = MerchantWallet.builder()
                    .merchantId(merchantId)
                    .availableBalance(BigDecimal.ZERO)
                    .holdingCodBalance(BigDecimal.ZERO)
                    .totalWithdrawn(BigDecimal.ZERO)
                    .bankName("MB Bank")
                    .bankAccountNumber("999988887777")
                    .bankAccountHolder("CHỦ SHOP")
                    .build();
            return walletRepository.save(newWallet);
        });
    }

    private ReconciliationSheetResponse mapToSheetResponse(ReconciliationSheet s, User m) {
        return ReconciliationSheetResponse.builder()
                .id(s.getId())
                .sheetCode(s.getSheetCode())
                .merchantId(s.getMerchantId())
                .merchantName(m != null ? m.getFullName() : "Shop #" + s.getMerchantId())
                .merchantEmail(m != null ? m.getEmail() : "")
                .startDate(s.getStartDate())
                .endDate(s.getEndDate())
                .totalOrders(s.getTotalOrders())
                .totalCod(s.getTotalCod())
                .totalShippingFee(s.getTotalShippingFee())
                .totalInsuranceFee(s.getTotalInsuranceFee())
                .netPayout(s.getNetPayout())
                .status(s.getStatus())
                .paidAt(s.getPaidAt())
                .bankTransactionCode(s.getBankTransactionCode())
                .createdAt(s.getCreatedAt())
                .build();
    }

    private WalletResponse mapToWalletResponse(MerchantWallet w, String merchantName) {
        return WalletResponse.builder()
                .id(w.getId())
                .merchantId(w.getMerchantId())
                .merchantName(merchantName)
                .availableBalance(w.getAvailableBalance())
                .holdingCodBalance(w.getHoldingCodBalance())
                .totalWithdrawn(w.getTotalWithdrawn())
                .bankName(w.getBankName())
                .bankAccountNumber(w.getBankAccountNumber())
                .bankAccountHolder(w.getBankAccountHolder())
                .updatedAt(w.getUpdatedAt())
                .build();
    }

    private WalletTransactionResponse mapToTransactionResponse(WalletTransaction tx) {
        return WalletTransactionResponse.builder()
                .id(tx.getId())
                .merchantId(tx.getMerchantId())
                .transactionCode(tx.getTransactionCode())
                .transactionType(tx.getTransactionType())
                .amount(tx.getAmount())
                .balanceAfter(tx.getBalanceAfter())
                .status(tx.getStatus())
                .referenceCode(tx.getReferenceCode())
                .description(tx.getDescription())
                .createdAt(tx.getCreatedAt())
                .build();
    }
}
