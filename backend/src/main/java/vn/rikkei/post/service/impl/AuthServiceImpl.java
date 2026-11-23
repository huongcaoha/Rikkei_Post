package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import vn.rikkei.post.dto.auth.*;
import vn.rikkei.post.entity.Role;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.repository.RoleRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.security.JwtTokenProvider;
import vn.rikkei.post.service.AuthService;
import vn.rikkei.post.service.EmailService;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final EmailService emailService;
    private final RestTemplate restTemplate;

    @Value("${oauth2.github.client-id:Ov23li7ujz4ZyEXugVa5}")
    private String githubClientId;

    @Value("${oauth2.github.client-secret:ecec2d3dcd5b47b3fdacbbad929cf6b9b4560f03}")
    private String githubClientSecret;

    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    public AuthResponse login(LoginRequest request) {
        // Kiểm tra xem tài khoản có bị vô hiệu hóa / chưa kích hoạt OTP hay không trước khi xác thực
        User userOpt = userRepository.findByUsername(request.getIdentifier())
                .or(() -> userRepository.findByEmail(request.getIdentifier()))
                .or(() -> userRepository.findByPhoneNumber(request.getIdentifier()))
                .orElse(null);

        if (userOpt != null && Boolean.FALSE.equals(userOpt.getIsActive())) {
            throw new IllegalArgumentException("Tài khoản chưa được kích hoạt qua mã xác thực OTP. Vui lòng kiểm tra email và nhập mã OTP để kích hoạt tài khoản!");
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getIdentifier(), request.getPassword())
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = tokenProvider.generateToken(authentication);

            CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
            Set<String> roles = userDetails.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .collect(Collectors.toSet());

            return AuthResponse.builder()
                    .accessToken(jwt)
                    .tokenType("Bearer")
                    .userId(userDetails.getId())
                    .username(userDetails.getUsername())
                    .fullName(userDetails.getFullName())
                    .phoneNumber(userDetails.getPhoneNumber())
                    .email(userDetails.getEmail())
                    .managedProvinceId(userDetails.getManagedProvinceId())
                    .managedProvinceName(userDetails.getManagedProvinceName())
                    .assignedPostOfficeId(userDetails.getAssignedPostOfficeId())
                    .postOfficeName(userDetails.getPostOfficeName())
                    .roles(roles)
                    .build();
        } catch (DisabledException ex) {
            throw new IllegalArgumentException("Tài khoản chưa được kích hoạt qua mã xác thực OTP. Vui lòng kiểm tra email để kích hoạt!");
        } catch (BadCredentialsException ex) {
            throw new IllegalArgumentException("Thông tin đăng nhập hoặc mật khẩu không chính xác!");
        }
    }

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username đã được sử dụng!");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email đã được sử dụng!");
        }
        if (userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
            throw new IllegalArgumentException("Số điện thoại đã được sử dụng!");
        }

        Set<Role> roles = new HashSet<>();
        if (request.getRoles() != null && !request.getRoles().isEmpty()) {
            for (String roleName : request.getRoles()) {
                roleRepository.findByRoleName(roleName).ifPresent(roles::add);
            }
        }

        // Mặc định gán ROLE_MERCHANT nếu chưa có role nào
        if (roles.isEmpty()) {
            Role defaultRole = roleRepository.findByRoleName("ROLE_MERCHANT")
                    .orElseGet(() -> roleRepository.save(Role.builder()
                            .roleName("ROLE_MERCHANT")
                            .description("Khách hàng / Chủ Shop tạo đơn")
                            .build()));
            roles.add(defaultRole);
        }

        // Tạo mã OTP ngẫu nhiên 6 chữ số
        String otpCode = String.format("%06d", RANDOM.nextInt(1000000));

        // Lưu tài khoản vào database với is_active = false và lưu mã otp
        User user = User.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phoneNumber(request.getPhoneNumber())
                .email(request.getEmail())
                .isActive(false)
                .otp(otpCode)
                .roles(roles)
                .build();

        user = userRepository.save(user);

        // Gửi mã OTP 6 chữ số qua email của người dùng
        try {
            emailService.sendRegistrationOtpEmail(user.getEmail(), user.getFullName(), otpCode);
            log.info("Đã gửi mã OTP kích hoạt tài khoản ({}) tới email: {}", otpCode, user.getEmail());
        } catch (Exception e) {
            log.error("Không thể gửi email OTP xác thực tới {}: {}", user.getEmail(), e.getMessage());
        }

        Set<String> roleNames = roles.stream().map(Role::getRoleName).collect(Collectors.toSet());

        // Chưa kích hoạt nên accessToken = null
        return AuthResponse.builder()
                .accessToken(null)
                .tokenType("Bearer")
                .userId(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .phoneNumber(user.getPhoneNumber())
                .email(user.getEmail())
                .roles(roleNames)
                .build();
    }

    @Override
    @Transactional
    public AuthResponse verifyOtp(VerifyOtpRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản với email: " + request.getEmail()));

        if (Boolean.TRUE.equals(user.getIsActive())) {
            // Đã kích hoạt trước đó, sinh token đăng nhập luôn
            String jwt = tokenProvider.generateTokenForUser(user);
            Set<String> roles = user.getRoles().stream().map(Role::getRoleName).collect(Collectors.toSet());
            return AuthResponse.builder()
                    .accessToken(jwt)
                    .tokenType("Bearer")
                    .userId(user.getId())
                    .username(user.getUsername())
                    .fullName(user.getFullName())
                    .phoneNumber(user.getPhoneNumber())
                    .email(user.getEmail())
                    .roles(roles)
                    .build();
        }

        if (user.getOtp() == null || !user.getOtp().trim().equals(request.getOtp().trim())) {
            throw new IllegalArgumentException("Mã OTP không chính xác. Vui lòng kiểm tra lại trong email của bạn!");
        }

        // Kích hoạt tài khoản thành công
        user.setIsActive(true);
        user.setOtp(null);
        userRepository.save(user);

        log.info("Tài khoản {} ({}) đã kích hoạt thành công qua mã OTP!", user.getUsername(), user.getEmail());

        // Gửi email chào mừng chính thức
        try {
            emailService.sendWelcomeEmail(user.getEmail(), user.getFullName(), user.getUsername());
        } catch (Exception e) {
            log.warn("Lỗi khi gửi email chào mừng: {}", e.getMessage());
        }

        // Sinh JWT token đăng nhập
        String jwt = tokenProvider.generateTokenForUser(user);
        Set<String> roles = user.getRoles().stream().map(Role::getRoleName).collect(Collectors.toSet());

        return AuthResponse.builder()
                .accessToken(jwt)
                .tokenType("Bearer")
                .userId(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .phoneNumber(user.getPhoneNumber())
                .email(user.getEmail())
                .roles(roles)
                .build();
    }

    @Override
    @Transactional
    public void resendOtp(ResendOtpRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản với email: " + request.getEmail()));

        if (Boolean.TRUE.equals(user.getIsActive())) {
            throw new IllegalArgumentException("Tài khoản này đã được kích hoạt trước đó, không cần gửi lại OTP!");
        }

        String newOtp = String.format("%06d", RANDOM.nextInt(1000000));
        user.setOtp(newOtp);
        userRepository.save(user);

        emailService.sendRegistrationOtpEmail(user.getEmail(), user.getFullName(), newOtp);
        log.info("Đã gửi lại mã OTP ({}) tới email: {}", newOtp, user.getEmail());
    }

    @Override
    @Transactional
    public AuthResponse processOAuth2Login(LoginOAuth2Request request) {
        String type = request.getType() != null ? request.getType().toLowerCase() : "";
        Map<String, Object> userInfo = null;

        try {
            if ("google".equalsIgnoreCase(type)) {
                userInfo = handleGoogleLogin(request.getAccessToken());
            } else if ("facebook".equalsIgnoreCase(type)) {
                userInfo = handleFacebookLogin(request.getAccessToken());
            } else if ("github".equalsIgnoreCase(type)) {
                userInfo = handleGithubLogin(request.getAccessToken());
            } else {
                throw new IllegalArgumentException("Nhà cung cấp OAuth2 không được hỗ trợ: " + type);
            }
        } catch (Exception e) {
            log.error("Lỗi xác thực OAuth2 từ {}: {}", type, e.getMessage());
            throw new IllegalArgumentException("Lỗi xác thực với " + type + ": " + e.getMessage());
        }

        if (userInfo == null) {
            throw new IllegalArgumentException("Không thể lấy thông tin người dùng từ " + type);
        }

        String email = (String) userInfo.get("email");
        if (email == null || email.trim().isEmpty()) {
            if ("github".equalsIgnoreCase(type)) {
                String login = (String) userInfo.get("login");
                email = login != null ? login + "@github.com" : null;
            } else if ("facebook".equalsIgnoreCase(type)) {
                String id = (String) userInfo.get("id");
                email = id != null ? id + "@facebook.com" : null;
            }
        }

        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("Tài khoản " + type + " của bạn không có Email công khai. Vui lòng cập nhật email hoặc đăng nhập bằng tài khoản thông thường.");
        }

        // KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT THEO YÊU CẦU:
        // Đăng nhập bên thứ 3 chỉ dùng để xác thực lấy email và kiểm tra nếu người dùng đã đăng ký thì mới cho vào,
        // nếu chưa đăng ký thì thông báo tài khoản chưa đăng ký.
        User user = userRepository.findByEmail(email).orElse(null);

        if (user == null) {
            log.warn("OAuth2 Login từ chối: Email [{}] chưa đăng ký trong hệ thống", email);
            throw new IllegalArgumentException("Tài khoản với email [" + email + "] chưa được đăng ký trong hệ thống Rikkei Post! Vui lòng thực hiện đăng ký tài khoản trước.");
        }

        if (Boolean.FALSE.equals(user.getIsActive())) {
            log.warn("OAuth2 Login từ chối: Tài khoản [{}] chưa kích hoạt OTP", email);
            throw new IllegalArgumentException("Tài khoản với email [" + email + "] chưa được kích hoạt qua mã xác thực OTP. Vui lòng kiểm tra email và nhập mã OTP kích hoạt!");
        }

        log.info("OAuth2 đăng nhập thành công cho người dùng: {} qua {}", user.getEmail(), type);

        // Sinh JWT token và trả về thông tin đăng nhập
        String jwt = tokenProvider.generateTokenForUser(user);
        Set<String> roles = user.getRoles().stream().map(Role::getRoleName).collect(Collectors.toSet());

        return AuthResponse.builder()
                .accessToken(jwt)
                .tokenType("Bearer")
                .userId(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .phoneNumber(user.getPhoneNumber())
                .email(user.getEmail())
                .roles(roles)
                .build();
    }

    private Map<String, Object> handleGoogleLogin(String token) {
        String url = "https://www.googleapis.com/oauth2/v3/userinfo";
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        HttpEntity<String> entity = new HttpEntity<>("", headers);

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
        return response.getBody();
    }

    private Map<String, Object> handleFacebookLogin(String token) {
        String url = "https://graph.facebook.com/me?fields=id,name,email,picture&access_token=" + token;
        ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
        return response.getBody();
    }

    private Map<String, Object> handleGithubLogin(String codeOrToken) {
        String accessToken = codeOrToken;

        // Nếu chuỗi truyền vào là Auth Code (độ dài ngắn và không bắt đầu bằng 'gh')
        if (!codeOrToken.startsWith("gh") && codeOrToken.length() < 40) {
            String tokenUrl = "https://github.com/login/oauth/access_token";
            Map<String, String> request = new HashMap<>();
            request.put("client_id", githubClientId);
            request.put("client_secret", githubClientSecret);
            request.put("code", codeOrToken);

            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.set("Accept", "application/json");
            tokenHeaders.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> tokenEntity = new HttpEntity<>(request, tokenHeaders);

            ResponseEntity<Map> tokenResponse = restTemplate.postForEntity(tokenUrl, tokenEntity, Map.class);
            Map<String, Object> tokenBody = tokenResponse.getBody();
            if (tokenBody != null && tokenBody.containsKey("access_token")) {
                accessToken = (String) tokenBody.get("access_token");
            } else {
                throw new IllegalArgumentException("Không thể lấy access token từ GitHub authorization code");
            }
        }

        String url = "https://api.github.com/user";
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        HttpEntity<String> entity = new HttpEntity<>("", headers);

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
        Map<String, Object> body = response.getBody();

        if (body != null && (body.get("email") == null || ((String) body.get("email")).isEmpty())) {
            // Lấy email phụ / riêng tư từ GitHub API
            try {
                String emailsUrl = "https://api.github.com/user/emails";
                ResponseEntity<List> emailsResponse = restTemplate.exchange(emailsUrl, HttpMethod.GET, entity, List.class);
                if (emailsResponse.getBody() != null) {
                    for (Object item : emailsResponse.getBody()) {
                        if (item instanceof Map) {
                            Map emailItem = (Map) item;
                            if (Boolean.TRUE.equals(emailItem.get("primary"))) {
                                body.put("email", emailItem.get("email"));
                                break;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Không thể lấy email phụ từ GitHub: {}", e.getMessage());
            }
        }

        return body;
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponse getCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Không tìm thấy user: " + username));

        Set<String> roles = user.getRoles().stream().map(Role::getRoleName).collect(Collectors.toSet());

        return AuthResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .phoneNumber(user.getPhoneNumber())
                .email(user.getEmail())
                .managedProvinceId(user.getManagedProvinceId())
                .managedProvinceName(user.getManagedProvinceName())
                .assignedPostOfficeId(user.getAssignedPostOfficeId())
                .postOfficeName(user.getPostOfficeName())
                .roles(roles)
                .build();
    }
}
