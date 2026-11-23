package vn.rikkei.post.service;

import vn.rikkei.post.dto.auth.*;

public interface AuthService {
    AuthResponse login(LoginRequest request);
    AuthResponse register(RegisterRequest request);
    AuthResponse verifyOtp(VerifyOtpRequest request);
    void resendOtp(ResendOtpRequest request);
    AuthResponse processOAuth2Login(LoginOAuth2Request request);
    AuthResponse getCurrentUser(String username);
}
