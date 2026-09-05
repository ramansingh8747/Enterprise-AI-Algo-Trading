import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/constants/routes';
import { authApi } from '@/services/api/authApi';

interface LoginPageProps {
  isAdmin?: boolean;
}

export default function LoginPage({ isAdmin = false }: LoginPageProps) {
  const { login, verifyOtp, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Mode: OTP (Mobile Number) vs PASSWORD (Email)
  const [loginMode, setLoginMode] = useState<'OTP' | 'PASSWORD'>('OTP');

  // OTP Login State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState<number>(0);
  const [testOtpNotice, setTestOtpNotice] = useState<string | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);

  // Password Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Refs for 6-digit OTP Block Inputs
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    let timer: any = null;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  const postLoginRoute = isAdmin ? ROUTES.ADMIN_DASHBOARD : (user?.role === 'ADMIN' ? ROUTES.ADMIN_DASHBOARD : ROUTES.DASHBOARD);

  if (isAuthenticated) {
    return <Navigate to={postLoginRoute} replace />;
  }

  // Handle Sending 6-digit OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setTestOtpNotice(null);
    setWhatsappLink(null);

    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.sendOtp({
        phone_number: cleanPhone.slice(-10),
        login_type: isAdmin ? 'admin' : 'trader',
      });
      setOtpSent(true);
      setSuccessMessage(res.message || 'WhatsApp OTP dispatched to your mobile number!');
      setCountdown(60);

      if (res.whatsapp_link) {
        setWhatsappLink(res.whatsapp_link);
      }

      // Auto-fill OTP digits for instant 1-second login & sign in
      if (res.otp_code && res.otp_code.length === 6) {
        setOtpDigits(res.otp_code.split(''));
        setSuccessMessage(`💬 [WhatsApp OTP]: ${res.otp_code} auto-filled! Click 'Verify & Sign In' below.`);
      } else {
        setOtpDigits(['', '', '', '', '', '']);
      }

      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please check mobile number.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Input Change for 6 Blocks
  const handleOtpDigitChange = (index: number, value: string) => {
    const char = value.replace(/[^\d]/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle KeyDown Backspace Navigation across 6 OTP blocks
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle Verifying 6-digit OTP
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const code = otpDigits.join('');
    if (code.length < 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }

    const cleanPhone = phoneNumber.replace(/[^\d]/g, '').slice(-10);
    setLoading(true);
    const loginType = isAdmin ? 'admin' : 'trader';

    try {
      const authenticatedUser = verifyOtp 
        ? await verifyOtp(cleanPhone, code, loginType)
        : (await authApi.verifyOtp({ phone_number: cleanPhone, otp_code: code, login_type: loginType })).user;
      navigate(isAdmin ? ROUTES.ADMIN_DASHBOARD : (authenticatedUser.role === 'ADMIN' ? ROUTES.ADMIN_DASHBOARD : ROUTES.DASHBOARD), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Login
  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    const loginType = isAdmin ? 'admin' : 'trader';

    try {
      const authenticatedUser = await login({ email: email.trim(), password, login_type: loginType });
      navigate(isAdmin ? ROUTES.ADMIN_DASHBOARD : (authenticatedUser.role === 'ADMIN' ? ROUTES.ADMIN_DASHBOARD : ROUTES.DASHBOARD), { replace: true });
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        const validationMsg = err.details.map((d: any) => d.msg || 'Invalid input').join(', ');
        setError(`Validation error: ${validationMsg}`);
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForgotModal = () => {
    setForgotEmail(email.trim());
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError(null);
    setForgotSuccess(null);
    setIsForgotModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    if (!forgotEmail || !forgotNewPassword || !forgotConfirmPassword) {
      setForgotError('Please fill in all fields.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('New passwords do not match.');
      return;
    }

    if (forgotNewPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Z]/.test(forgotNewPassword)) {
      setForgotError('Password must contain at least one uppercase letter (A-Z).');
      return;
    }

    if (!/[0-9]/.test(forgotNewPassword)) {
      setForgotError('Password must contain at least one digit (0-9).');
      return;
    }

    setForgotLoading(true);
    try {
      await authApi.forgotPassword({
        email: forgotEmail.trim(),
        new_password: forgotNewPassword,
      });

      setForgotSuccess('Password reset successfully! You can now log in.');
      setEmail(forgotEmail.trim());
      setPassword('');
      setSuccessMessage('Password changed successfully! Please enter your new password to sign in.');
      
      setTimeout(() => {
        setIsForgotModalOpen(false);
      }, 1200);
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        const validationMsg = err.details.map((d: any) => d.msg || 'Invalid input').join(', ');
        setForgotError(`Validation error: ${validationMsg}`);
      } else {
        setForgotError(err.message || 'Failed to reset password. Please check your email.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(14, 165, 233, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(99, 102, 241, 0.1) 0%, transparent 50%), #020617',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.6) 100%)',
        borderRadius: '1.25rem',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 30px rgba(14, 165, 233, 0.12)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            background: isAdmin 
              ? 'linear-gradient(135deg, #d97706 0%, #b45309 50%, #7c2d12 100%)' 
              : 'linear-gradient(135deg, #0284c7 0%, #3b82f6 50%, #6366f1 100%)',
            boxShadow: isAdmin 
              ? '0 0 24px rgba(245, 158, 11, 0.4)' 
              : '0 0 24px rgba(56, 189, 248, 0.4)',
            fontSize: 24,
            fontWeight: 900,
            margin: '0 auto 1rem',
          }}>
            {isAdmin ? '🛡️' : '⚡'}
          </div>

          <h2 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            {isAdmin ? (
              <>Antigravity<span style={{ color: '#f59e0b' }}>Admin</span></>
            ) : (
              <>Antigravity<span style={{ color: '#38bdf8' }}>Algo</span></>
            )}
          </h2>
          <p style={{ margin: '0.4rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
            {isAdmin ? 'Sign in to Admin Console (Restricted Authorization)' : 'Enterprise AI Quant Trading Terminal'}
          </p>
          {isAdmin && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.75rem',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '9999px',
              color: '#fde68a',
              fontSize: '0.75rem',
              fontWeight: 700,
              marginTop: '0.65rem',
            }}>
              <span>🔒</span> Restricted Admin Access
            </div>
          )}
        </div>

        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              borderRadius: '0.5rem',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: 800,
              textDecoration: 'none',
              marginBottom: '1.25rem',
              boxShadow: '0 4px 14px rgba(37, 211, 102, 0.4)',
              transition: 'transform 0.15s ease',
            }}
          >
            <span>💬 Send OTP to my WhatsApp (+91-{phoneNumber.slice(-10)})</span>
          </a>
        )}

        {successMessage && (
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '0.5rem',
            color: '#6ee7b7',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '0.5rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', color: '#cbd5e1', fontSize: '0.8125rem', fontWeight: 700 }}>
              Indian Mobile Number (+91)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{
                padding: '0.75rem 0.85rem',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: '#38bdf8',
                fontSize: '0.9rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
              }}>
                +91
              </span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="9876543210"
                maxLength={10}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: 'rgba(2, 6, 23, 0.6)',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  outline: 'none',
                  letterSpacing: '0.05em',
                }}
              />
            </div>
          </div>

          {!otpSent ? (
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading || phoneNumber.length < 10}
              style={{
                marginTop: '0.5rem',
                padding: '0.85rem',
                background: loading || phoneNumber.length < 10 ? '#334155' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 800,
                cursor: loading || phoneNumber.length < 10 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          ) : (
            <form onSubmit={handleVerifyOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.6rem', color: '#cbd5e1', fontSize: '0.8125rem', fontWeight: 700, textAlign: 'center' }}>
                  Enter 6-Digit Verification Code
                </label>
                {/* 6 Block OTP Inputs */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      style={{
                        width: '42px',
                        height: '50px',
                        textAlign: 'center',
                        fontSize: '1.4rem',
                        fontWeight: 900,
                        color: '#38bdf8',
                        background: 'rgba(2, 6, 23, 0.8)',
                        border: digit ? '2px solid #38bdf8' : '1px solid #334155',
                        borderRadius: '0.5rem',
                        outline: 'none',
                        boxShadow: digit ? '0 0 12px rgba(56, 189, 248, 0.4)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otpDigits.join('').length < 6}
                style={{
                  padding: '0.85rem',
                  background: loading || otpDigits.join('').length < 6 ? '#334155' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: loading || otpDigits.join('').length < 6 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                <span>Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={countdown > 0}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: countdown > 0 ? '#64748b' : '#38bdf8',
                    fontWeight: 700,
                    cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={{ marginTop: '1.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          {isAdmin ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'center' }}>
              <div>
                Don't have an account?{' '}
                <Link to={ROUTES.ADMIN_REGISTER} style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>
                  Create Admin Account 🛡️
                </Link>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Are you a trader?{' '}
                <Link to={ROUTES.LOGIN} style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>
                  Switch to Trader Login
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                Don't have an account?{' '}
                <Link to={ROUTES.REGISTER} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 700 }}>
                  Create Account
                </Link>
              </span>
              <Link to={ROUTES.ADMIN_LOGIN} style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>
                Admin Login 🛡️
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(2, 6, 23, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          zIndex: 1000,
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            borderRadius: '1.25rem',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.2)',
            padding: '2rem',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 100%)',
                  fontSize: 18,
                }}>
                  🔐
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                    Reset Password
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Change password for your account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  borderRadius: '0.5rem',
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                ✕
              </button>
            </div>

            {forgotSuccess && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '0.5rem',
                color: '#6ee7b7',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
              }}>
                ✅ {forgotSuccess}
              </div>
            )}

            {forgotError && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '0.5rem',
                color: '#fca5a5',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
              }}>
                ⚠️ {forgotError}
              </div>
            )}

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    background: 'rgba(2, 6, 23, 0.7)',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  required
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    background: 'rgba(2, 6, 23, 0.7)',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    background: 'rgba(2, 6, 23, 0.7)',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.5)', padding: '0.6rem 0.8rem', borderRadius: '0.375rem', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                ℹ️ Password must be at least 8 characters, with 1 uppercase letter and 1 number.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    color: '#94a3b8',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{
                    flex: 1.5,
                    padding: '0.75rem',
                    background: forgotLoading ? '#334155' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: forgotLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  }}
                >
                  {forgotLoading ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

