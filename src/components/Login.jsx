import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Small delay for UX feel
    setTimeout(() => {
      const result = login(email, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error);
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="login-container">
      <div className="login-card fade-in">
        <div className="brand">
          <img src="/logo_reviel.png" alt="Reviel Logo" style={{ maxWidth: '100%', height: 'auto', maxHeight: '64px', marginBottom: '12px' }} />
          <p>Admin Console</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@reviel.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          {error && <p className="login-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default Login;
