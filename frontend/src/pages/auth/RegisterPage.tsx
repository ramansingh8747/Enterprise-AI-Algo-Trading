import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/services/api/authApi';
import { ROUTES } from '@/constants/routes';

interface RegisterPageProps {
  isAdmin?: boolean;
}

export default function RegisterPage({ isAdmin = false }: RegisterPageProps) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'ADMIN' ? ROUTES.ADMIN_DASHBOARD : ROUTES.DASHBOARD} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic client validation matching backend contract
    if (!email || !username || !fullName || !phoneNumber) {
      setError('Please fill in all required fields including mobile number.');
      return;
    }

    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (username.length < 3 || username.length > 50) {
      setError('Username must be between 3 and 50 characters.');
      return;
    }

    if (fullName.length < 2 || fullName.length > 255) {
      setError('Full name must be between 2 and 255 characters.');
      return;
    }

    setLoading(true);

    try {
      await authApi.register({
        email: email.trim().toLowerCase(),
        username: username.trim(),
        full_name: fullName.trim(),
        phone_number: cleanPhone.slice(-10),
        password: 'Password@123',
        role: isAdmin ? 'ADMIN' : 'TRADER',
      });

      setSuccess(isAdmin ? 'Admin account registered successfully! You can now sign in to Admin Console.' : 'Registration successful! You can now sign in using Mobile OTP.');
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        const validationMsg = err.details.map((d: any) => d.msg || 'Invalid field').join(', ');
        setError(`Validation error: ${validationMsg}`);
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
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
        maxWidth: '460px',
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
            {isAdmin ? 'Create Administrator Account' : 'Create Trader Account'}
          </h2>
          <p style={{ margin: '0.4rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
            {isAdmin ? 'Register Master Administrator Credentials for Admin Console' : 'Join the Enterprise Quant AI Trading Platform'}
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
              <span>🛡️</span> Administrator Account
            </div>
          )}
        </div>

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

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              padding: '1rem',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(74, 222, 128, 0.35)',
              borderRadius: '0.5rem',
              color: '#86efac',
              fontSize: '0.9rem',
              fontWeight: 600,
              marginBottom: '1.5rem',
            }}>
              ✓ {success}
            </div>
            <button
              type="button"
              onClick={() => navigate(isAdmin ? ROUTES.ADMIN_LOGIN : ROUTES.LOGIN)}
              style={{
                width: '100%',
                padding: '0.85rem',
                background: isAdmin
                  ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                  : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: isAdmin ? '0 4px 14px rgba(217, 119, 6, 0.35)' : '0 4px 14px rgba(37, 99, 235, 0.35)',
              }}
            >
              {isAdmin ? 'Sign In to Admin Console →' : 'Sign In to Your Account →'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', color: '#cbd5e1', fontSize: '0.8125rem', fontWeight: 700 }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAdmin ? 'admin@enterprise.com' : 'trader@enterprise.com'}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(2, 6, 23, 0.6)',
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
              <label style={{ display: 'block', marginBottom: '0.35rem', color: '#cbd5e1', fontSize: '0.8125rem', fontWeight: 700 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isAdmin ? 'admin_ops' : 'quant_trader'}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(2, 6, 23, 0.6)',
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
              <label style={{ display: 'block', marginBottom: '0.35rem', color: '#cbd5e1', fontSize: '0.8125rem', fontWeight: 700 }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isAdmin ? 'System Administrator' : 'Quantitative Trader'}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(2, 6, 23, 0.6)',
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
              <label style={{ display: 'block', marginBottom: '0.35rem', color: '#cbd5e1', fontSize: '0.8125rem', fontWeight: 700 }}>
                Mobile Number (Mandatory for WhatsApp/SMS OTP)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{
                  padding: '0.75rem 0.85rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                  color: '#38bdf8',
                  fontSize: '0.875rem',
                  fontWeight: 700,
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
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(2, 6, 23, 0.6)',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                padding: '0.85rem',
                background: loading
                  ? '#334155'
                  : (isAdmin ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)'),
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: isAdmin ? '0 4px 14px rgba(217, 119, 6, 0.35)' : '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? 'Creating Account...' : (isAdmin ? 'Register Admin Account' : 'Complete Registration')}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          {isAdmin ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                Already have an admin account?{' '}
                <Link to={ROUTES.ADMIN_LOGIN} style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>
                  Sign In 🛡️
                </Link>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Looking for Trader Registration?{' '}
                <Link to={ROUTES.REGISTER} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 700 }}>
                  Create Trader Account
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                Already have an account?{' '}
                <Link to={ROUTES.LOGIN} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 700 }}>
                  Sign In
                </Link>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Need an Administrator Account?{' '}
                <Link to={ROUTES.ADMIN_REGISTER} style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>
                  Create Admin Account 🛡️
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
