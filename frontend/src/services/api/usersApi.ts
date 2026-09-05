import { BaseApi } from './BaseApi';
import { UserResponse } from '@/types/auth';

export interface UserUpdateRequest {
  full_name?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface AdminUserUpdateRequest {
  full_name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  is_verified?: boolean;
}

export class UsersApi extends BaseApi {
  async getMe(): Promise<UserResponse> {
    return this.handleRequest<UserResponse>(
      this.http.get('/users/me'),
      false
    );
  }

  async listUsers(
    skip = 0,
    limit = 10,
    filters: { search?: string; role?: string; is_active?: boolean } = {},
  ): Promise<{ total: number; items: UserResponse[] }> {
    return this.handleRequest<{ total: number; items: UserResponse[] }>(
      this.http.get('/admin/users', { params: { skip, limit, ...filters } }),
      false
    );
  }

  async getUser(id: string): Promise<UserResponse> {
    return this.handleRequest<UserResponse>(
      this.http.get(`/admin/users/${id}`),
      false
    );
  }

  async updateAdminUser(id: string, data: AdminUserUpdateRequest): Promise<UserResponse> {
    return this.handleRequest<UserResponse>(
      this.http.put(`/admin/users/${id}`, data),
      false
    );
  }

  async deleteAdminUser(id: string): Promise<void> {
    await this.handleRequest<void>(
      this.http.delete(`/admin/users/${id}`),
      false
    );
  }

  async updateMe(data: UserUpdateRequest): Promise<UserResponse> {
    return this.handleRequest<UserResponse>(
      this.http.put('/users/me', data),
      false
    );
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await this.handleRequest<void>(
      this.http.put('/users/change-password', data),
      false
    );
  }
}

export const usersApi = new UsersApi();
