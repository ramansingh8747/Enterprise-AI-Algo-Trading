import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { validateEnv } from '@/config/env';
import { API_TIMEOUT, API_HEADERS } from '@/constants/api';

const env = validateEnv();

const axiosInstance: AxiosInstance = axios.create({
  baseURL: env.VITE_API_URL,
  timeout: API_TIMEOUT,
  headers: API_HEADERS,
});

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Placeholder for Authorization header
  // config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Request-ID'] = crypto.randomUUID();
  return config;
});

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // Global API Error Mapper
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default axiosInstance;
