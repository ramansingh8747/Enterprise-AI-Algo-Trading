export interface UserResponse {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: string;
  phone_number?: string | null;
  is_active: boolean;
  is_verified: boolean;
  last_login?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  login_type?: 'trader' | 'admin';
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserResponse;
}

export interface RegisterRequest {
  email: string;
  username: string;
  full_name: string;
  password: string;
  phone_number?: string;
  role?: string;
}

export interface ForgotPasswordRequest {
  email: string;
  new_password: string;
}

export interface SendOTPRequest {
  phone_number: string;
  login_type?: 'trader' | 'admin';
}

export interface VerifyOTPRequest {
  phone_number: string;
  otp_code: string;
  login_type?: 'trader' | 'admin';
}

export interface OTPResponse {
  status: string;
  message: string;
  phone_number: string;
  otp_code?: string;
  whatsapp_link?: string;
}


