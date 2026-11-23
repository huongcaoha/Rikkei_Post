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
import vn.rikkei.post.repository.ProvinceRepository;
import vn.rikkei.post.repository.RoleRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.repository.WardRepository;
import vn.rikkei.post.repository.WarehouseRepository;

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
                    .managedProvinceName("Hà Nội")
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
                    .managedProvinceName("Hà Nội")
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
                    .managedProvinceName("Hà Nội")
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

        // 6. Khởi tạo danh mục 63 Tỉnh/Thành phố & Xã/Phường Việt Nam (Code-First ORM)
        if (provinceRepository.count() == 0) {
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
                        .routeName("Tuyến Cầu Giấy - Duy Tân - Dịch Vọng Hậu")
                        .provinceId(1)
                        .provinceName("Hà Nội")
                        .districtName("Cầu Giấy")
                        .wardName("Phường Dịch Vọng Hậu")
                        .postOfficeId(spokeCgWh != null ? spokeCgWh.getId() : 4L)
                        .postOfficeName(spokeCgWh != null ? spokeCgWh.getName() : "Bưu cục Cầu Giấy")
                        .assignedShipperId(shipperDuyTan != null ? shipperDuyTan.getId() : null)
                        .assignedShipperName(shipperDuyTan != null ? shipperDuyTan.getFullName() : "Bưu tá Nguyễn Văn Ship")
                        .assignedShipperPhone(shipperDuyTan != null ? shipperDuyTan.getPhoneNumber() : "0987111222")
                        .streetKeywords("Duy Tân, Trần Thái Tông, Tôn Thất Thuyết, Cầu Giấy, Xuân Thủy, Dịch Vọng Hậu")
                        .description("Tuyến phục vụ khu vực văn phòng và chung cư đường Duy Tân, Cầu Giấy")
                        .isActive(true)
                        .build(),
                DeliveryRoute.builder()
                        .routeCode("ROUTE_HN_HBT_DACOVIET")
                        .routeName("Tuyến Hai Bà Trưng - Đại Cồ Việt - Bách Khoa")
                        .provinceId(1)
                        .provinceName("Hà Nội")
                        .districtName("Hai Bà Trưng")
                        .wardName("Phường Bách Khoa")
                        .postOfficeId(spokeHbtWh != null ? spokeHbtWh.getId() : 3L)
                        .postOfficeName(spokeHbtWh != null ? spokeHbtWh.getName() : "Bưu cục Hai Bà Trưng")
                        .streetKeywords("Đại Cồ Việt, Bạch Mai, Giải Phóng, Phố Huế, Lê Thanh Nghị, Bách Khoa")
                        .description("Tuyến trường đại học Bách Khoa, Xây Dựng, Kinh Tế và phố Đại Cồ Việt")
                        .isActive(true)
                        .build(),
                DeliveryRoute.builder()
                        .routeCode("ROUTE_SGN_TB_CONGHOA")
                        .routeName("Tuyến Tân Bình - Cộng Hòa - Trường Chinh")
                        .provinceId(79)
                        .provinceName("TP. Hồ Chí Minh")
                        .districtName("Tân Bình")
                        .wardName("Phường 1 (Tân Bình)")
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
        log.info("Bắt đầu nạp danh mục 63 Tỉnh/Thành phố và Xã/Phường chuẩn quốc gia...");
        List<Province> provinces = List.of(
                // --- MIỀN BẮC (NORTH) ---
                Province.builder().id(1).code("HN").name("Hà Nội").region("NORTH").displayOrder(1).build(),
                Province.builder().id(2).code("HG").name("Hà Giang").region("NORTH").displayOrder(10).build(),
                Province.builder().id(4).code("CB").name("Cao Bằng").region("NORTH").displayOrder(11).build(),
                Province.builder().id(6).code("BK").name("Bắc Kạn").region("NORTH").displayOrder(12).build(),
                Province.builder().id(8).code("TQ").name("Tuyên Quang").region("NORTH").displayOrder(13).build(),
                Province.builder().id(10).code("LC").name("Lào Cai").region("NORTH").displayOrder(14).build(),
                Province.builder().id(11).code("DB").name("Điện Biên").region("NORTH").displayOrder(15).build(),
                Province.builder().id(12).code("LCH").name("Lai Châu").region("NORTH").displayOrder(16).build(),
                Province.builder().id(14).code("SL").name("Sơn La").region("NORTH").displayOrder(17).build(),
                Province.builder().id(15).code("YB").name("Yên Bái").region("NORTH").displayOrder(18).build(),
                Province.builder().id(17).code("HB").name("Hòa Bình").region("NORTH").displayOrder(19).build(),
                Province.builder().id(19).code("TN").name("Thái Nguyên").region("NORTH").displayOrder(5).build(),
                Province.builder().id(20).code("LS").name("Lạng Sơn").region("NORTH").displayOrder(20).build(),
                Province.builder().id(22).code("QN").name("Quảng Ninh").region("NORTH").displayOrder(6).build(),
                Province.builder().id(24).code("BG").name("Bắc Giang").region("NORTH").displayOrder(7).build(),
                Province.builder().id(25).code("PT").name("Phú Thọ").region("NORTH").displayOrder(21).build(),
                Province.builder().id(26).code("VP").name("Vĩnh Phúc").region("NORTH").displayOrder(8).build(),
                Province.builder().id(27).code("BN").name("Bắc Ninh").region("NORTH").displayOrder(4).build(),
                Province.builder().id(30).code("HD").name("Hải Dương").region("NORTH").displayOrder(9).build(),
                Province.builder().id(31).code("HP").name("Hải Phòng").region("NORTH").displayOrder(3).build(),
                Province.builder().id(33).code("HY").name("Hưng Yên").region("NORTH").displayOrder(22).build(),
                Province.builder().id(34).code("TB").name("Thái Bình").region("NORTH").displayOrder(23).build(),
                Province.builder().id(35).code("HNA").name("Hà Nam").region("NORTH").displayOrder(24).build(),
                Province.builder().id(36).code("ND").name("Nam Định").region("NORTH").displayOrder(25).build(),
                Province.builder().id(37).code("NB").name("Ninh Bình").region("NORTH").displayOrder(26).build(),

                // --- MIỀN TRUNG (CENTRAL) ---
                Province.builder().id(38).code("TH").name("Thanh Hóa").region("CENTRAL").displayOrder(27).build(),
                Province.builder().id(40).code("NA").name("Nghệ An").region("CENTRAL").displayOrder(28).build(),
                Province.builder().id(42).code("HT").name("Hà Tĩnh").region("CENTRAL").displayOrder(29).build(),
                Province.builder().id(44).code("QB").name("Quảng Bình").region("CENTRAL").displayOrder(30).build(),
                Province.builder().id(45).code("QT").name("Quảng Trị").region("CENTRAL").displayOrder(31).build(),
                Province.builder().id(46).code("TTH").name("Thừa Thiên Huế").region("CENTRAL").displayOrder(32).build(),
                Province.builder().id(48).code("DNA").name("Đà Nẵng").region("CENTRAL").displayOrder(2).build(),
                Province.builder().id(49).code("QNA").name("Quảng Nam").region("CENTRAL").displayOrder(33).build(),
                Province.builder().id(51).code("QNG").name("Quảng Ngãi").region("CENTRAL").displayOrder(34).build(),
                Province.builder().id(52).code("BDH").name("Bình Định").region("CENTRAL").displayOrder(35).build(),
                Province.builder().id(54).code("PY").name("Phú Yên").region("CENTRAL").displayOrder(36).build(),
                Province.builder().id(56).code("KH").name("Khánh Hòa").region("CENTRAL").displayOrder(37).build(),
                Province.builder().id(58).code("NT").name("Ninh Thuận").region("CENTRAL").displayOrder(38).build(),
                Province.builder().id(60).code("BTH").name("Bình Thuận").region("CENTRAL").displayOrder(39).build(),
                Province.builder().id(62).code("KT").name("Kon Tum").region("CENTRAL").displayOrder(40).build(),
                Province.builder().id(64).code("GL").name("Gia Lai").region("CENTRAL").displayOrder(41).build(),
                Province.builder().id(66).code("DL").name("Đắk Lắk").region("CENTRAL").displayOrder(42).build(),
                Province.builder().id(67).code("DNO").name("Đắk Nông").region("CENTRAL").displayOrder(43).build(),
                Province.builder().id(68).code("LD").name("Lâm Đồng").region("CENTRAL").displayOrder(44).build(),

            // --- MIỀN NAM (SOUTH) ---
            Province.builder().id(70).code("BP").name("Bình Phước").region("SOUTH").displayOrder(45).build(),
            Province.builder().id(72).code("TNIN").name("Tây Ninh").region("SOUTH").displayOrder(46).build(),
            Province.builder().id(74).code("BD").name("Bình Dương").region("SOUTH").displayOrder(6).build(),
            Province.builder().id(75).code("DON").name("Đồng Nai").region("SOUTH").displayOrder(47).build(),
            Province.builder().id(77).code("BRVT").name("Bà Rịa - Vũng Tàu").region("SOUTH").displayOrder(48).build(),
            Province.builder().id(79).code("SGN").name("TP. Hồ Chí Minh").region("SOUTH").displayOrder(2).build(),
            Province.builder().id(80).code("LA").name("Long An").region("SOUTH").displayOrder(49).build(),
            Province.builder().id(82).code("TG").name("Tiền Giang").region("SOUTH").displayOrder(50).build(),
            Province.builder().id(83).code("BTR").name("Bến Tre").region("SOUTH").displayOrder(51).build(),
            Province.builder().id(84).code("TV").name("Trà Vinh").region("SOUTH").displayOrder(52).build(),
            Province.builder().id(86).code("VL").name("Vĩnh Long").region("SOUTH").displayOrder(53).build(),
            Province.builder().id(87).code("DT").name("Đồng Tháp").region("SOUTH").displayOrder(54).build(),
            Province.builder().id(89).code("AG").name("An Giang").region("SOUTH").displayOrder(55).build(),
            Province.builder().id(91).code("KG").name("Kiên Giang").region("SOUTH").displayOrder(56).build(),
            Province.builder().id(92).code("CT").name("Cần Thơ").region("SOUTH").displayOrder(5).build(),
            Province.builder().id(93).code("HGIA").name("Hậu Giang").region("SOUTH").displayOrder(57).build(),
            Province.builder().id(94).code("ST").name("Sóc Trăng").region("SOUTH").displayOrder(58).build(),
            Province.builder().id(95).code("BL").name("Bạc Liêu").region("SOUTH").displayOrder(59).build(),
            Province.builder().id(96).code("CM").name("Cà Mau").region("SOUTH").displayOrder(60).build()
        );
        provinceRepository.saveAll(provinces);
        log.info("Đã lưu thành công 63 Tỉnh/Thành phố vào cơ sở dữ liệu!");

        // Khởi tạo danh mục Xã / Phường tiêu biểu cho các Tỉnh Thành
        List<Ward> wards = new java.util.ArrayList<>();

        // 1. Hà Nội (ID: 1)
        List<String> hnWards = List.of(
                "Phường Dịch Vọng Hậu", "Phường Dịch Vọng", "Phường Trung Hòa", "Phường Yên Hòa",
                "Phường Láng Thượng", "Phường Ô Chợ Dừa", "Phường Bách Khoa", "Phường Hàng Bạc",
                "Phường Tràng Tiền", "Phường Mỹ Đình 1", "Phường Mỹ Đình 2", "Phường Mễ Trì",
                "Phường Cầu Diễn", "Phường Khương Trung", "Phường Định Công", "Xã Tân Triều",
                "Xã An Khánh", "Xã Ninh Hiệp");
        for (String w : hnWards) {
            wards.add(Ward.builder().provinceId(1).name(w).districtName("Hà Nội").isActive(true).build());
        }

        // 2. TP. Hồ Chí Minh (ID: 79)
        List<String> hcmWards = List.of(
                "Phường Bến Nghé", "Phường Bến Thành", "Phường Tân Định", "Phường Đa Kao",
                "Phường Võ Thị Sáu", "Phường Thảo Điền", "Phường An Phú", "Phường Hiệp Bình Chánh",
                "Phường Linh Trung", "Phường 1 (Tân Bình)", "Phường 2 (Tân Bình)", "Phường 12 (Gò Vấp)",
                "Phường Tân Chánh Hiệp", "Xã Bình Hưng", "Xã Vĩnh Lộc A");
        for (String w : hcmWards) {
            wards.add(Ward.builder().provinceId(79).name(w).districtName("TP. Hồ Chí Minh").isActive(true).build());
        }

        // 3. Đà Nẵng (ID: 48)
        List<String> dnWards = List.of(
                "Phường Hải Châu 1", "Phường Hải Châu 2", "Phường Thạch Thang", "Phường Hòa Cường Bắc",
                "Phường Hòa Cường Nam", "Phường Mỹ An", "Phường Khuê Mỹ", "Phường An Hải Bắc",
                "Phường Hòa Khánh Bắc");
        for (String w : dnWards) {
            wards.add(Ward.builder().provinceId(48).name(w).districtName("Đà Nẵng").isActive(true).build());
        }

        // 4. Hải Phòng (ID: 31)
        List<String> hpWards = List.of(
                "Phường Hoàng Văn Thụ", "Phường Minh Khai", "Phường Lạch Tray", "Phường Đằng Giang",
                "Phường Quán Toan", "Phường Vạn Mỹ");
        for (String w : hpWards) {
            wards.add(Ward.builder().provinceId(31).name(w).districtName("Hải Phòng").isActive(true).build());
        }

        // 5. Cần Thơ (ID: 92)
        List<String> ctWards = List.of(
                "Phường An Cư", "Phường An Hội", "Phường Cái Khế", "Phường Hưng Lợi",
                "Phường Xuân Khánh", "Phường Trà Nóc");
        for (String w : ctWards) {
            wards.add(Ward.builder().provinceId(92).name(w).districtName("Cần Thơ").isActive(true).build());
        }

        // 6. Bình Dương (ID: 74)
        List<String> bdWards = List.of(
                "Phường Phú Hòa", "Phường Phú Cường", "Phường Dĩ An", "Phường An Phú",
                "Phường Lái Thiêu", "Phường Thuận Giao");
        for (String w : bdWards) {
            wards.add(Ward.builder().provinceId(74).name(w).districtName("Bình Dương").isActive(true).build());
        }

        // 7. Đồng Nai (ID: 75)
        List<String> donWards = List.of(
                "Phường Trảng Dài", "Phường Tân Hiệp", "Phường Long Bình", "Phường Biên Hòa");
        for (String w : donWards) {
            wards.add(Ward.builder().provinceId(75).name(w).districtName("Đồng Nai").isActive(true).build());
        }

        // Các tỉnh thành còn lại: Khởi tạo các phường/xã trung tâm mặc định
        for (Province p : provinces) {
            if (p.getId() != 1 && p.getId() != 79 && p.getId() != 48 && p.getId() != 31 && p.getId() != 92
                    && p.getId() != 74 && p.getId() != 75) {
                wards.add(Ward.builder().provinceId(p.getId()).name("Phường 1 (" + p.getName() + ")")
                        .districtName(p.getName()).isActive(true).build());
                wards.add(Ward.builder().provinceId(p.getId()).name("Phường 2 (" + p.getName() + ")")
                        .districtName(p.getName()).isActive(true).build());
                wards.add(Ward.builder().provinceId(p.getId()).name("Phường Trung Tâm").districtName(p.getName())
                        .isActive(true).build());
                wards.add(Ward.builder().provinceId(p.getId()).name("Xã Trung Tâm").districtName(p.getName())
                        .isActive(true).build());
            }
        }

        wardRepository.saveAll(wards);
        log.info("Đã khởi tạo thành công {} Xã/Phường mẫu trên toàn quốc!", wards.size());
    }

    private Role initRole(String roleName, String desc) {
        return roleRepository.findByRoleName(roleName)
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .roleName(roleName)
                        .description(desc)
                        .build()));
    }
}
