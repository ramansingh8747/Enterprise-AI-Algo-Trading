import { BaseApi } from './BaseApi';
import { LoginRequest, TokenResponse, RegisterRequest, UserResponse } from '@/types/auth';

export class AuthApi extends BaseApi {
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    return this.handleRequest<TokenResponse>(
      this.http.post('/auth/login', credentials),
      true
    );
  }

  async register(data: RegisterRequest): Promise<UserResponse> {
    return this.handleRequest<UserResponse>(
      this.http.post('/auth/register', data),
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
