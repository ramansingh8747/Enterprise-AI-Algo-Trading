import { BaseApi } from './BaseApi';
import {
  LoginRequest,
  TokenResponse,
  RegisterRequest,
  UserResponse,
  ForgotPasswordRequest,
  SendOTPRequest,
  VerifyOTPRequest,
  OTPResponse,
} from '@/types/auth';

export class AuthApi extends BaseApi {
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    return this.handleRequest<TokenResponse>(
      this.http.post('/auth/login', credentials),
      true
    );
  }

  async sendOtp(data: SendOTPRequest): Promise<OTPResponse> {
    return this.handleRequest<OTPResponse>(
      this.http.post('/auth/send-otp', data),
      true
    );
  }

  async verifyOtp(data: VerifyOTPRequest): Promise<TokenResponse> {
    return this.handleRequest<TokenResponse>(
      this.http.post('/auth/verify-otp', data),
      true
    );
  }

  async register(data: RegisterRequest): Promise<UserResponse> {
    return this.handleRequest<UserResponse>(
      this.http.post('/auth/register', data),
      true
    );
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<UserResponse> {
    return this.handleRequest<UserResponse>(
      this.http.post('/auth/forgot-password', data),
      true
    );
  }

  async getMe(): Promise<UserResponse> {
    return this.handleRequest<UserResponse>(
      this.http.get('/auth/me'),
      true
    );
  }
}

export const authApi = new AuthApi();

