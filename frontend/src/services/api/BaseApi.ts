import axiosInstance from '@/services/http/axios';
import { ApiError } from './ApiError';

export abstract class BaseApi {
  protected http = axiosInstance;

  protected async handleRequest<T>(request: Promise<any>, isWrapped: boolean = true): Promise<T> {
    try {
      const response = await request;
      
      if (isWrapped) {
        const data = response.data;
        if (!data.success) {
          throw new ApiError(data.message);
        }
        return data.data;
      }
      
      return response.data;
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = error.response?.data?.message || error.message || 'API request failed';
      const details = error.response?.data?.data !== undefined ? error.response?.data?.data : error.response?.data;
      throw new ApiError(message, error.response?.status, details);
    }
  }
}
