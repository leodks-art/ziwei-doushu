'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || '登录失败');
      return;
    }
    router.push('/admin-ziwei');
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ width: '100%', maxWidth: 360, display: 'grid', gap: 12 }}>
      <input
        value={username}
        onChange={e => setUsername(e.target.value)}
        placeholder="管理员账号"
        autoComplete="username"
        style={inputStyle}
      />
      <input
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="管理员密码"
        type="password"
        autoComplete="current-password"
        style={inputStyle}
      />
      {error && <div style={{ color: '#b42318', fontSize: 13 }}>{error}</div>}
      <button disabled={loading} style={buttonStyle}>
        {loading ? '登录中...' : '登录后台'}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  height: 44,
  border: '1px solid var(--bdr)',
  borderRadius: 8,
  padding: '0 12px',
  background: 'var(--bg-card)',
  color: 'var(--tx-0)',
};

const buttonStyle: React.CSSProperties = {
  height: 44,
  border: 'none',
  borderRadius: 8,
  background: 'var(--ac)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};
