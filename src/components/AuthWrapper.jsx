import React, { useState } from 'react';
import Dashboard from './Dashboard';

const hardcodedEmail = 'info@reviel.app';
const hardcodedPassword = 'Reviel@007';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email === hardcodedEmail && password === hardcodedPassword) {
      setError(null);
      onLoginSuccess();
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '400px', margin: '80px auto' }}>
      <h2 className="waitlist-title">Reviel Admin Dashboard</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-group" style={{ marginBottom: '20px' }}>
          <input
            type="email"
            className="glass-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="input-group" style={{ marginBottom: '20px' }}>
          <input
            type="password"
            className="glass-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: '#ff4444' }}>{error}</p>}
        <button type="submit" className="btn-primary" style={{ borderRadius: '40px' }}>
          Login
        </button>
      </form>
    </div>
  );
}

export default function AuthWrapper() {
  const [loggedIn, setLoggedIn] = useState(false);
  return loggedIn ? <Dashboard /> : <Login onLoginSuccess={() => setLoggedIn(true)} />;
}
