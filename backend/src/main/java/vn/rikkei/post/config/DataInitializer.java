package vn.rikkei.post.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import vn.rikkei.post.entity.DeliveryRoute;
import vn.rikkei.post.entity.PricingMatrix;
import vn.rikkei.post.entity.Province;
import vn.rikkei.post.entity.Role;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Ward;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.DeliveryRouteRepository;
import vn.rikkei.post.repository.PricingMatrixRepository;
import vn.rikkei.post.repository.PricingPolicyRepository;
import vn.rikkei.post.repository.ProvinceRepository;
import vn.rikkei.post.repository.RoleRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.repository.WardRepository;
import vn.rikkei.post.repository.WarehouseRepository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.transaction.annotation.Transactional;

/**
 * Khởi tạo dữ liệu mẫu mặc định khi ứng dụng khởi chạy
 * Tự động tạo Roles, User demo, Bảng cước & Kho
 * Tác giả: Nguyễn Công Hưởng
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PricingMatrixRepository pricingMatrixRepository;
    private final PricingPolicyRepository pricingPolicyRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProvinceRepository provinceRepository;
    private final WardRepository wardRepository;
    private final DeliveryRouteRepository routeRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Bắt đầu kiểm tra và khởi tạo dữ liệu mẫu cho Rikkei_Post...");

        // 1. Khởi tạo danh mục Roles chuẩn
        Role roleMerchant = initRole("ROLE_MERCHANT", "Khách hàng / Chủ Shop tạo đơn bưu chính");
        Role roleShipper = initRole("ROLE_SHIPPER", "Bưu tá giao nhận hàng chặng cuối");
        Role roleWarehouse = initRole("ROLE_WAREHOUSE_STAFF", "Nhân viên kho và trung tâm khai thác chia chọn");
        Role roleDispatcher = initRole("ROLE_DISPATCHER", "Điều phối viên vận tải đường trục");
        Role roleAccountant = initRole("ROLE_ACCOUNTANT", "Kế toán đối soát công nợ & tiền COD");
        Role roleBranchManager = initRole("ROLE_BRANCH_MANAGER", "Quản lý chi nhánh Tỉnh / Thành phố");
        Role rolePostOfficeManager = initRole("ROLE_POST_OFFICE_MANAGER", "Quản lý bưu cục kho vận");
        Role roleAdmin = initRole("ROLE_ADMIN", "Quản trị viên toàn quyền hệ thống");

        // 2. Khởi tạo tài khoản Demo cho Chủ shop (merchant_demo)
        if (!userRepository.existsByUsername("merchant_demo")) {
            User demoMerchant = User.builder()
                    .username("merchant_demo")
                    .password(passwordEncoder.encode("Password@123"))
                    .fullName("Chủ Shop Thời Trang Demo")
                    .phoneNumber("0912345678")
                    .email("shop_demo@rikkeipost.vn")
                    .isActive(true)
                    .roles(new HashSet<>(Set.of(roleMerchant)))
                    .build();
            userRepository.save(demoMerchant);
            log.info("Đã tạo tài khoản demo: merchant_demo / Password@123");
        }

        // 3. Khởi tạo tài khoản Quản trị viên (admin_rikkei) có NHIỀU VAI TRÒ
        if (!userRepository.existsByUsername("admin_rikkei")) {
            User admin = User.builder()
                    .username("admin_rikkei")
                    .password(passwordEncoder.encode("Password@123"))
                    .fullName("Nguyễn Công Hưởng (Admin)")
                    .phoneNumber("0900000000")
                    .email("admin@rikkeipost.vn")
                    .isActive(true)
                    .roles(new HashSet<>(Set.of(roleAdmin, roleMerchant, roleWarehouse)))
                    .build();
            userRepository.save(admin);
            log.info("Đã tạo tài khoản quản trị: admin_rikkei / Password@123 (Đa vai trò)");
        }

        // 4. Khởi tạo tài khoản Quản lý chi nhánh Hà Nội (branch_hn)
        if (!userRepository.existsByUsername("branch_hn")) {
            User branchManager = User.builder()
                    .username("branch_hn")
                    .password(passwordEncoder.encode("Password@123"))
                    .fullName("Trần Văn Quản Lý (Chi Nhánh HN)")
                    .phoneNumber("0911223344")
                    .email("branch_hn@rikkeipost.vn")
                    .managedProvinceId(1)
                    .managedProvinceName("Thành phố Hà Nội")
                    .isActive(true)
                    .roles(new HashSet<>(Set.of(roleBranchManager)))
                    .build();
            userRepository.save(branchManager);
            log.info("Đã tạo tài khoản demo: branch_hn / Password@123 (ROLE_BRANCH_MANAGER)");
        }

        // 5. Khởi tạo tài khoản Quản lý bưu cục Cầu Giấy (manager_cg)
        Warehouse spokeCgWh = warehouseRepository.findByCode("SPOKE_HN_CG").orElse(null);
        Long cgWarehouseId = spokeCgWh != null ? spokeCgWh.getId() : 4L;
        if (!userRepository.existsByUsername("manager_cg")) {
            User postManager = User.builder()
                    .username("manager_cg")
                    .password(passwordEncoder.encode("Password@123"))
                    .fullName("Phạm Trưởng Bưu Cục Cầu Giấy")
                    .phoneNumber("0933445566")
                    .email("manager_cg@rikkeipost.vn")
                    .managedProvinceId(1)
                    .managedProvinceName("Thành phố Hà Nội")
                    .assignedPostOfficeId(cgWarehouseId)
                    .postOfficeName("Bưu cục Cầu Giấy")
                    .isActive(true)
                    .roles(new HashSet<>(Set.of(rolePostOfficeManager)))
                    .build();
            userRepository.save(postManager);
            log.info("Đã tạo tài khoản demo: manager_cg / Password@123 (ROLE_POST_OFFICE_MANAGER)");
        }

        // 6. Khởi tạo tài khoản Shipper Cầu Giấy (shipper_duytan)
        User shipperDuyTan = userRepository.findByUsername("shipper_duytan").orElse(null);
        if (shipperDuyTan == null) {
            shipperDuyTan = User.builder()
                    .username("shipper_duytan")
                    .password(passwordEncoder.encode("Password@123"))
                    .fullName("Bưu tá Nguyễn Văn Ship")
                    .phoneNumber("0987111222")
                    .email("shipper_duytan@rikkeipost.vn")
                    .assignedPostOfficeId(cgWarehouseId)
                    .postOfficeName("Bưu cục Cầu Giấy")
                    .isActive(true)
                    .roles(new HashSet<>(Set.of(roleShipper)))
                    .build();
            shipperDuyTan = userRepository.save(shipperDuyTan);
            log.info("Đã tạo tài khoản demo: shipper_duytan / Password@123 (ROLE_SHIPPER)");
        }

        // 7. Khởi tạo tài khoản Nhân viên kho Cầu Giấy (staff_cg)
        if (!userRepository.existsByUsername("staff_cg")) {
            User staffCg = User.builder()
                    .username("staff_cg")
                    .password(passwordEncoder.encode("Password@123"))
                    .fullName("Nguyễn Văn Kho (Bưu Cục Cầu Giấy)")
                    .phoneNumber("0944556677")
                    .email("staff_cg@rikkeipost.vn")
                    .managedProvinceId(1)
                    .managedProvinceName("Thành phố Hà Nội")
                    .assignedPostOfficeId(cgWarehouseId)
                    .postOfficeName("Bưu cục Cầu Giấy")
                    .isActive(true)
                    .roles(new HashSet<>(Set.of(roleWarehouse)))
                    .build();
            userRepository.save(staffCg);
            log.info("Đã tạo tài khoản demo: staff_cg / Password@123 (ROLE_WAREHOUSE_STAFF)");
        }

        // 4. Khởi tạo bảng giá cước chuẩn
        if (pricingMatrixRepository.count() == 0) {
            List<PricingMatrix> matrices = List.of(
                    PricingMatrix.builder().serviceType("STANDARD").zoneType("INTRA_PROVINCE").baseWeightGram(500)
                            .basePrice(BigDecimal.valueOf(16000)).stepWeightGram(500)
                            .stepPrice(BigDecimal.valueOf(3000)).estimatedDeliveryHours(24).isActive(true).build(),
                    PricingMatrix.builder().serviceType("STANDARD").zoneType("INTRA_REGION").baseWeightGram(500)
                            .basePrice(BigDecimal.valueOf(26000)).stepWeightGram(500)
                            .stepPrice(BigDecimal.valueOf(5000)).estimatedDeliveryHours(48).isActive(true).build(),
                    PricingMatrix.builder().serviceType("STANDARD").zoneType("INTER_REGION_NEAR").baseWeightGram(500)
                            .basePrice(BigDecimal.valueOf(32000)).stepWeightGram(500)
                            .stepPrice(BigDecimal.valueOf(6000)).estimatedDeliveryHours(72).isActive(true).build(),
                    PricingMatrix.builder().serviceType("STANDARD").zoneType("INTER_REGION_FAR").baseWeightGram(500)
                            .basePrice(BigDecimal.valueOf(38000)).stepWeightGram(500)
                            .stepPrice(BigDecimal.valueOf(7000)).estimatedDeliveryHours(96).isActive(true).build(),
                    PricingMatrix.builder().serviceType("EXPRESS").zoneType("INTRA_PROVINCE").baseWeightGram(500)
                            .basePrice(BigDecimal.valueOf(24000)).stepWeightGram(500)
                            .stepPrice(BigDecimal.valueOf(4500)).estimatedDeliveryHours(12).isActive(true).build(),
                    PricingMatrix.builder().serviceType("EXPRESS").zoneType("INTER_REGION_FAR").baseWeightGram(500)
                            .basePrice(BigDecimal.valueOf(49000)).stepWeightGram(500)
                            .stepPrice(BigDecimal.valueOf(9500)).estimatedDeliveryHours(24).isActive(true).build());
            pricingMatrixRepository.saveAll(matrices);
            log.info("Đã khởi tạo ma trận giá cước tiêu chuẩn (Standard & Express)");
        }

        // 4.1 Khởi tạo chính sách phụ phí vận hành động
        if (pricingPolicyRepository.count() == 0) {
            vn.rikkei.post.entity.PricingPolicy defaultPolicy = vn.rikkei.post.entity.PricingPolicy.builder()
                    .doorPickupBaseFee(BigDecimal.valueOf(15000))
                    .freePickupOrderThreshold(5)
                    .bulkyWeightThresholdGram(2000)
                    .bulkyMaxDimensionCm(40)
                    .bulkySumDimensionsCm(80)
                    .bulkyExtraPricePerKg(BigDecimal.valueOf(5000))
                    .oversizeDimensionFee(BigDecimal.valueOf(10000))
                    .insuranceValueThreshold(BigDecimal.valueOf(1000000))
                    .insurancePercentRate(BigDecimal.valueOf(0.005))
                    .build();
            pricingPolicyRepository.save(defaultPolicy);
            log.info("Đã khởi tạo chính sách phụ phí vận hành tiêu chuẩn (PricingPolicy)");
        }

        // 5. Khởi tạo danh mục Bưu cục & Hub mẫu
        if (warehouseRepository.count() == 0) {
            List<Warehouse> hubs = List.of(
                    Warehouse.builder().code("HUB_HN_NORTH").name("Trung tâm Khai thác Hub Bắc Hà Nội").type("HUB")
                            .provinceId(1).districtId(1).address("Khu công nghiệp Quang Minh, Mê Linh, Hà Nội")
                            .latitude(21.1833).longitude(105.7500).capacityPackages(100000).isActive(true).build(),
                    Warehouse.builder().code("HUB_SGN_SOUTH").name("Trung tâm Khai thác Hub Nam Sài Gòn").type("HUB")
                            .provinceId(79).districtId(760).address("Khu công nghiệp Tân Bình, Tân Phú, TP.HCM")
                            .latitude(10.8010).longitude(106.6320).capacityPackages(100000).isActive(true).build(),
                    Warehouse.builder().code("SPOKE_HN_HBT").name("Bưu cục Hai Bà Trưng").type("SPOKE_POST_OFFICE")
                            .provinceId(1).districtId(5).address("Số 15 Phố Đại Cồ Việt, Hai Bà Trưng, Hà Nội")
                            .latitude(21.0068).longitude(105.8432).capacityPackages(10000).isActive(true).build(),
                    Warehouse.builder().code("SPOKE_HN_CG").name("Bưu cục Cầu Giấy").type("SPOKE_POST_OFFICE")
                            .provinceId(1).districtId(3).address("Số 21 Phố Duy Tân, Cầu Giấy, Hà Nội")
                            .latitude(21.0313).longitude(105.7831).capacityPackages(10000).isActive(true).build(),
                    Warehouse.builder().code("SPOKE_SGN_TB").name("Bưu cục Tân Bình").type("SPOKE_POST_OFFICE")
                            .provinceId(79).districtId(760).address("Số 150 Cộng Hòa, Phường 12, Tân Bình, TP.HCM")
                            .latitude(10.8015).longitude(106.6521).capacityPackages(15000).isActive(true).build(),
                    Warehouse.builder().code("HUB_DN_CENTRAL").name("Trung tâm Khai thác Hub Miền Trung Đà Nẵng").type("HUB")
                            .provinceId(48).districtId(490).address("Khu công nghiệp Hòa Khánh, Liên Chiểu, Đà Nẵng")
                            .latitude(16.0680).longitude(108.1500).capacityPackages(80000).isActive(true).build());
            warehouseRepository.saveAll(hubs);
            log.info("Đã khởi tạo danh sách Hub và Bưu cục mẫu");
        }

        // 6. Khởi tạo danh mục 34 Tỉnh/Thành phố & 3321 Xã/Phường Việt Nam (quy chuẩn hành chính mới)
        if (provinceRepository.count() != 34 || wardRepository.count() != 3321) {
            initProvincesAndWards();
        }

        // 7. Khởi tạo danh mục Tuyến đường và phân bổ Shipper phụ trách
        if (routeRepository.count() == 0) {
            initDeliveryRoutes();
        }

        log.info("Khởi tạo dữ liệu mẫu hoàn tất!");
    }

    private void initDeliveryRoutes() {
        Warehouse spokeCgWh = warehouseRepository.findByCode("SPOKE_HN_CG").orElse(null);
        Warehouse spokeHbtWh = warehouseRepository.findByCode("SPOKE_HN_HBT").orElse(null);
        Warehouse hubSgnWh = warehouseRepository.findByCode("HUB_SGN_SOUTH").orElse(null);
        User shipperDuyTan = userRepository.findByUsername("shipper_duytan").orElse(null);

        List<DeliveryRoute> routes = List.of(
                DeliveryRoute.builder()
                        .routeCode("ROUTE_HN_CG_DUYTAN")
                        .routeName("Tuyến Cầu Giấy - Duy Tân - Cầu Giấy")
                        .provinceId(1)
                        .provinceName("Thành phố Hà Nội")
                        .districtName("Cầu Giấy")
                        .wardName("Phường Cầu Giấy")
                        .postOfficeId(spokeCgWh != null ? spokeCgWh.getId() : 4L)
                        .postOfficeName(spokeCgWh != null ? spokeCgWh.getName() : "Bưu cục Cầu Giấy")
                        .assignedShipperId(shipperDuyTan != null ? shipperDuyTan.getId() : null)
                        .assignedShipperName(shipperDuyTan != null ? shipperDuyTan.getFullName() : "Bưu tá Nguyễn Văn Ship")
                        .assignedShipperPhone(shipperDuyTan != null ? shipperDuyTan.getPhoneNumber() : "0987111222")
                        .streetKeywords("Duy Tân, Trần Thái Tông, Tôn Thất Thuyết, Cầu Giấy, Xuân Thủy")
                        .description("Tuyến phục vụ khu vực văn phòng và chung cư đường Duy Tân, Cầu Giấy")
                        .isActive(true)
                        .build(),
                DeliveryRoute.builder()
                        .routeCode("ROUTE_HN_HBT_DACOVIET")
                        .routeName("Tuyến Hai Bà Trưng - Đại Cồ Việt - Bạch Mai")
                        .provinceId(1)
                        .provinceName("Thành phố Hà Nội")
                        .districtName("Hai Bà Trưng")
                        .wardName("Phường Hai Bà Trưng")
                        .postOfficeId(spokeHbtWh != null ? spokeHbtWh.getId() : 3L)
                        .postOfficeName(spokeHbtWh != null ? spokeHbtWh.getName() : "Bưu cục Hai Bà Trưng")
                        .streetKeywords("Đại Cồ Việt, Bạch Mai, Giải Phóng, Phố Huế, Lê Thanh Nghị")
                        .description("Tuyến trường đại học Bách Khoa, Xây Dựng, Kinh Tế và phố Đại Cồ Việt")
                        .isActive(true)
                        .build(),
                DeliveryRoute.builder()
                        .routeCode("ROUTE_SGN_TB_CONGHOA")
                        .routeName("Tuyến Tân Bình - Cộng Hòa - Trường Chinh")
                        .provinceId(79)
                        .provinceName("Thành phố Hồ Chí Minh")
                        .districtName("Tân Bình")
                        .wardName("Phường Tân Sơn Hòa")
                        .postOfficeId(hubSgnWh != null ? hubSgnWh.getId() : 2L)
                        .postOfficeName(hubSgnWh != null ? hubSgnWh.getName() : "Trung tâm Khai thác Hub Nam Sài Gòn")
                        .streetKeywords("Cộng Hòa, Trường Chinh, Hoàng Hoa Thám, Tân Bình")
                        .description("Tuyến giao nhận trục đường Cộng Hòa, Tân Bình")
                        .isActive(true)
                        .build()
        );
        routeRepository.saveAll(routes);
        log.info("Đã khởi tạo thành công {} tuyến đường mẫu kèm phân bổ bưu tá phụ trách!", routes.size());
    }

    private void initProvincesAndWards() {
        log.info("Bắt đầu nạp danh mục 34 Tỉnh/Thành phố và 3321 Xã/Phường chuẩn hành chính từ dữ liệu chuẩn...");
        try {
            wardRepository.deleteAllInBatch();
            provinceRepository.deleteAllInBatch();

            ObjectMapper mapper = new ObjectMapper();

            ClassPathResource provResource = new ClassPathResource("data/provinces_34.json");
            try (InputStream is = provResource.getInputStream()) {
                List<Province> provinces = mapper.readValue(is, new TypeReference<List<Province>>() {});
                provinceRepository.saveAll(provinces);
                log.info("Đã nạp thành công {} Tỉnh/Thành phố vào cơ sở dữ liệu!", provinces.size());
            }

            ClassPathResource wardResource = new ClassPathResource("data/wards_3321.json");
            try (InputStream is = wardResource.getInputStream()) {
                List<Ward> wards = mapper.readValue(is, new TypeReference<List<Ward>>() {});
                wardRepository.saveAll(wards);
                log.info("Đã nạp thành công {} Xã/Phường trên toàn quốc vào cơ sở dữ liệu!", wards.size());
            }
        } catch (Exception e) {
            log.error("Lỗi khi nạp dữ liệu Tỉnh/Thành và Xã/Phường: {}", e.getMessage(), e);
        }
    }

    private Role initRole(String roleName, String desc) {
        return roleRepository.findByRoleName(roleName)
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .roleName(roleName)
                        .description(desc)
                        .build()));
    }
}
