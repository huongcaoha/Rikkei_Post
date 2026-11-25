package vn.rikkei.post.service.impl;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.voucher.*;
import vn.rikkei.post.entity.PaymentVoucher;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.PaymentVoucherRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.NotificationService;
import vn.rikkei.post.service.PaymentVoucherService;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentVoucherServiceImpl implements PaymentVoucherService {

    private final PaymentVoucherRepository voucherRepository;
    private final UserRepository userRepository;
    private final WarehouseRepository warehouseRepository;
    private final NotificationService notificationService;
    private final Random random = new Random();

    @Override
    @Transactional
    public PaymentVoucherResponse createVoucher(CreateVoucherRequest request, CustomUserDetails currentUser) {
        User user = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài khoản người tạo!"));

        Long whId = request.getWarehouseId() != null ? request.getWarehouseId() : user.getAssignedPostOfficeId();
        Warehouse wh = whId != null ? warehouseRepository.findById(whId).orElse(null) : null;
        String whName = wh != null ? wh.getName() : "Bưu cục điều hành";
        Integer provId = wh != null ? wh.getProvinceId() : user.getManagedProvinceId();

        String type = request.getVoucherType().trim().toUpperCase();
        if (!"RECEIPT".equals(type) && !"PAYMENT".equals(type)) {
            throw new IllegalArgumentException("Loại phiếu không hợp lệ! Chỉ chấp nhận RECEIPT (Phiếu thu) hoặc PAYMENT (Phiếu chi).");
        }

        String code = generateUniqueVoucherCode(type);
        String roleTitle = user.getRoles().stream()
                .map(r -> r.getRoleName())
                .filter(r -> !r.equals("ROLE_MERCHANT"))
                .findFirst().orElse("ROLE_STAFF");

        PaymentVoucher voucher = PaymentVoucher.builder()
                .voucherCode(code)
                .voucherType(type)
                .category(request.getCategory().trim().toUpperCase())
                .amount(request.getAmount())
                .title(request.getTitle().trim())
                .description(request.getDescription())
                .proofAttachmentUrl(request.getProofAttachmentUrl())
                .createdByUserId(user.getId())
                .createdByUserName(user.getFullName())
                .createdByUserRole(roleTitle)
                .warehouseId(whId)
                .warehouseName(whName)
                .provinceId(provId)
                .status("PENDING")
                .build();

        PaymentVoucher saved = voucherRepository.save(voucher);
        log.info("Người dùng {} đã tạo phiếu {} [{}] số tiền: {}, chờ Kế toán duyệt.",
                user.getFullName(), type, code, request.getAmount());

        // Gửi thông báo tới bộ phận Kế toán (ROLE_ACCOUNTANT & ROLE_ADMIN)
        String typeLabel = "RECEIPT".equals(type) ? "Phiếu thu" : "Phiếu chi";
        String notifMsg = String.format("%s [%s] số tiền %,d đ được tạo bởi %s (%s). Vui lòng xét duyệt!",
                typeLabel, code, request.getAmount().longValue(), user.getFullName(), whName);
        notificationService.notifyUsersByRole("ROLE_ACCOUNTANT", "Yêu cầu duyệt " + typeLabel + " mới", notifMsg, "VOUCHER", "/accountant/vouchers");
        notificationService.notifyUsersByRole("ROLE_ADMIN", "Yêu cầu duyệt " + typeLabel + " mới", notifMsg, "VOUCHER", "/accountant/vouchers");

        return mapToResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentVoucherResponse> getMyVouchers(CustomUserDetails currentUser, String voucherType, String status, LocalDate startDate, LocalDate endDate) {
        Specification<PaymentVoucher> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("createdByUserId"), currentUser.getId()));

            if (voucherType != null && !voucherType.isBlank() && !"ALL".equalsIgnoreCase(voucherType)) {
                predicates.add(cb.equal(root.get("voucherType"), voucherType.trim().toUpperCase()));
            }
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(root.get("status"), status.trim().toUpperCase()));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startDate.atStartOfDay()));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endDate.atTime(23, 59, 59)));
            }

            query.orderBy(cb.desc(root.get("createdAt")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return voucherRepository.findAll(spec).stream().map(this::mapToResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentVoucherResponse> getAllVouchers(CustomUserDetails currentUser, String voucherType, String status, Long warehouseId, LocalDate startDate, LocalDate endDate) {
        boolean isAdmin = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        boolean isAccountant = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_ACCOUNTANT".equals(a.getAuthority()));
        boolean isBranchManager = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_BRANCH_MANAGER".equals(a.getAuthority()));

        Specification<PaymentVoucher> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Quản lý chi nhánh chỉ xem các phiếu trong tỉnh mình quản lý
            if (isBranchManager && !isAdmin && !isAccountant && currentUser.getManagedProvinceId() != null) {
                predicates.add(cb.equal(root.get("provinceId"), currentUser.getManagedProvinceId()));
            }

            if (warehouseId != null) {
                predicates.add(cb.equal(root.get("warehouseId"), warehouseId));
            }
            if (voucherType != null && !voucherType.isBlank() && !"ALL".equalsIgnoreCase(voucherType)) {
                predicates.add(cb.equal(root.get("voucherType"), voucherType.trim().toUpperCase()));
            }
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(root.get("status"), status.trim().toUpperCase()));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startDate.atStartOfDay()));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endDate.atTime(23, 59, 59)));
            }

            query.orderBy(cb.desc(root.get("createdAt")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return voucherRepository.findAll(spec).stream().map(this::mapToResponse).toList();
    }

    @Override
    @Transactional
    public PaymentVoucherResponse approveVoucher(Long id, ApproveVoucherRequest request, CustomUserDetails currentUser) {
        PaymentVoucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phiếu ID: " + id));

        if (!"PENDING".equalsIgnoreCase(voucher.getStatus())) {
            throw new IllegalStateException("Phiếu [" + voucher.getVoucherCode() + "] hiện đang ở trạng thái: " + voucher.getStatus() + ", không thể duyệt!");
        }

        voucher.setStatus("APPROVED");
        voucher.setApprovedByUserId(currentUser.getId());
        voucher.setApprovedByUserName(currentUser.getFullName());
        voucher.setApprovedAt(LocalDateTime.now());
        if (request != null && request.getDisbursementMethod() != null) {
            voucher.setDisbursementMethod(request.getDisbursementMethod().trim().toUpperCase());
        }

        PaymentVoucher saved = voucherRepository.save(voucher);
        log.info("Kế toán {} đã duyệt & giải ngân phiếu {} [{}] số tiền: {}",
                currentUser.getFullName(), saved.getVoucherType(), saved.getVoucherCode(), saved.getAmount());

        // Gửi thông báo tới người tạo phiếu
        String typeLabel = "RECEIPT".equals(saved.getVoucherType()) ? "Phiếu thu" : "Phiếu chi";
        String msg = String.format("Chúc mừng! %s [%s] số tiền %,d đ của bạn đã được Kế toán %s phê duyệt và giải ngân thành công.",
                typeLabel, saved.getVoucherCode(), saved.getAmount().longValue(), currentUser.getFullName());
        notificationService.createNotification(saved.getCreatedByUserId(), typeLabel + " đã được giải ngân", msg, "VOUCHER", "/vouchers/my");

        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public PaymentVoucherResponse rejectVoucher(Long id, RejectVoucherRequest request, CustomUserDetails currentUser) {
        PaymentVoucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phiếu ID: " + id));

        if (!"PENDING".equalsIgnoreCase(voucher.getStatus())) {
            throw new IllegalStateException("Phiếu [" + voucher.getVoucherCode() + "] hiện đang ở trạng thái: " + voucher.getStatus() + ", không thể từ chối!");
        }

        voucher.setStatus("REJECTED");
        voucher.setApprovedByUserId(currentUser.getId());
        voucher.setApprovedByUserName(currentUser.getFullName());
        voucher.setApprovedAt(LocalDateTime.now());
        voucher.setRejectionReason(request.getRejectionReason().trim());

        PaymentVoucher saved = voucherRepository.save(voucher);
        log.info("Kế toán {} đã từ chối phiếu {} [{}] do: {}",
                currentUser.getFullName(), saved.getVoucherType(), saved.getVoucherCode(), request.getRejectionReason());

        // Gửi thông báo tới người tạo phiếu
        String typeLabel = "RECEIPT".equals(saved.getVoucherType()) ? "Phiếu thu" : "Phiếu chi";
        String msg = String.format("%s [%s] số tiền %,d đ của bạn bị Kế toán từ chối. Lý do: %s",
                typeLabel, saved.getVoucherCode(), saved.getAmount().longValue(), request.getRejectionReason());
        notificationService.createNotification(saved.getCreatedByUserId(), typeLabel + " bị từ chối", msg, "VOUCHER", "/vouchers/my");

        return mapToResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentVoucherResponse getVoucherById(Long id, CustomUserDetails currentUser) {
        PaymentVoucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phiếu ID: " + id));
        return mapToResponse(voucher);
    }

    private String generateUniqueVoucherCode(String type) {
        String prefix = "RECEIPT".equals(type) ? "PT" : "PC";
        String monthStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyMM"));
        String code;
        do {
            int rand = 1000 + random.nextInt(9000);
            code = prefix + monthStr + "-" + rand;
        } while (voucherRepository.findByVoucherCode(code).isPresent());
        return code;
    }

    private PaymentVoucherResponse mapToResponse(PaymentVoucher v) {
        return PaymentVoucherResponse.builder()
                .id(v.getId())
                .voucherCode(v.getVoucherCode())
                .voucherType(v.getVoucherType())
                .category(v.getCategory())
                .amount(v.getAmount())
                .title(v.getTitle())
                .description(v.getDescription())
                .proofAttachmentUrl(v.getProofAttachmentUrl())
                .createdByUserId(v.getCreatedByUserId())
                .createdByUserName(v.getCreatedByUserName())
                .createdByUserRole(v.getCreatedByUserRole())
                .warehouseId(v.getWarehouseId())
                .warehouseName(v.getWarehouseName())
                .provinceId(v.getProvinceId())
                .status(v.getStatus())
                .approvedByUserId(v.getApprovedByUserId())
                .approvedByUserName(v.getApprovedByUserName())
                .approvedAt(v.getApprovedAt())
                .rejectionReason(v.getRejectionReason())
                .disbursementMethod(v.getDisbursementMethod())
                .createdAt(v.getCreatedAt())
                .updatedAt(v.getUpdatedAt())
                .build();
    }
}
