import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const S = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a15 0%, #0f0f2a 100%)',
    padding: '1rem',
  },
  card: {
    width: '100%', maxWidth: '400px',
    background: '#13131f', borderRadius: '16px',
    padding: '2rem', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: '1px solid #1e1e30',
  },
  header: { textAlign: 'center', marginBottom: '2rem' },
  logo: { fontSize: '3rem', marginBottom: '0.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.25rem' },
  sub: { fontSize: '0.9rem', color: '#6b6b8a' },
  tab: (active) => ({
    flex: 1, padding: '0.6rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontSize: '0.9rem', fontWeight: 600,
    background: active ? '#FF6B00' : 'transparent',
    color: active ? '#fff' : '#6b6b8a',
    transition: 'all 0.2s',
  }),
  tabs: {
    display: 'flex', gap: '4px', background: '#0a0a15', borderRadius: '10px',
    padding: '4px', marginBottom: '1.5rem',
  },
  label: { display: 'block', fontSize: '0.8rem', color: '#9b9bb8', marginBottom: '0.4rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' },
  input: {
    display: 'block', width: '100%', padding: '0.75rem 1rem',
    background: '#0a0a15', border: '1px solid #1e1e30', borderRadius: '8px',
    color: '#e8e8f0', fontSize: '1rem', marginBottom: '1rem', outline: 'none',
  },
  btn: {
    width: '100%', padding: '0.875rem', background: '#FF6B00', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 700,
    cursor: 'pointer', marginTop: '0.5rem',
  },
  error: { color: '#ff4d4d', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (tab === 'login') await login(username, password);
      else await register(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally { setLoading(false); }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.header}>
          <div style={S.logo}>🏏</div>
          <div style={S.title}>IPL Watch Party</div>
          <div style={S.sub}>Watch cricket together, live.</div>
        </div>

        <div style={S.tabs}>
          <button style={S.tab(tab === 'login')} onClick={() => setTab('login')}>Login</button>
          <button style={S.tab(tab === 'register')} onClick={() => setTab('register')}>Register</button>
        </div>

        {error && <p style={S.error}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <label style={S.label}>Username</label>
          <input
            style={S.input} value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. rcb_fan_42" required minLength={2} maxLength={20}
            autoComplete="username"
          />
          <label style={S.label}>Password</label>
          <input
            style={S.input} type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters" required minLength={6}
            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
          />
          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? 'Please wait...' : tab === 'login' ? 'Enter Watch Party' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
