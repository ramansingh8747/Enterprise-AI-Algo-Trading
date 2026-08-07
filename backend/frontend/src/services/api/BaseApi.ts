import axiosInstance from '@/services/http/axios';
import { ApiResponse } from '@/types';
import { ApiError } from './ApiError';

export abstract class BaseApi {
  protected http = axiosInstance;

  protected async handleRequest<T>(request: Promise<any>): Promise<T> {
    try {
      const response = await request;
      const data: ApiResponse<T> = response.data;
      if (!data.success) {
        throw new ApiError(data.message);
      }
      return data.data;
    } catch (error: any) {
      throw new ApiError(error.message || 'API request failed', error.response?.status, error.response?.data);
    }
  }
}
