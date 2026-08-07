export type ApiResponse<T = any> = {
  success: boolean;
  message: string;
  data: T;
};

export type ApiError = {
  message: string;
  details?: any;
};
