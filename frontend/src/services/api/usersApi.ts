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

export class UsersApi extends BaseApi {
  async getMe(): Promise<UserResponse> {
    return this.handleRequest<UserResponse>(
      this.http.get('/users/me'),
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
