'use client';
import { useState } from 'react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) window.location.href = '/';
    else { setError(data.error || 'Login failed'); setBusy(false); }
  };
  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brandmark dark"><span className="logo-dot" aria-hidden="true" /><span>Creative Studio</span></div>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
          {error && <small className="err">{error}</small>}
        </label>
        <button className="btn primary" disabled={busy || !password}>{busy ? 'Checking…' : 'Log in'}</button>
      </form>
    </div>
  );
}
