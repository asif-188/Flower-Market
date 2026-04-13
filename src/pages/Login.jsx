import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Petals from '../components/Petals';

// Local tenant credentials (matches legacy app)
const TENANTS = {
  sakura:  { password: 'shop123',  name: 'Sakura Flower Market' },
  pooja:   { password: 'pooja123', name: 'Pooja Flower Market' },
  krishna: { password: 'kris123',  name: 'Krishna Flower Market' },
};

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        const tenant = TENANTS[username.toLowerCase()];
        if (tenant && tenant.password === password) {
            sessionStorage.setItem('fm_logged_in', 'true');
            sessionStorage.setItem('fm_tenant',    username.toLowerCase());
            sessionStorage.setItem('fm_tenant_name', tenant.name);
            navigate('/app');
        } else {
            setError('Invalid username or password.');
        }
    };

    return (
        <div className="page page-login">
            <Petals />
            <div className="login-card glass-card">
                <div className="login-logo-wrap">
                    <div className="login-logo-icon">🌿</div>
                    <h1 className="login-title">Flower Market Billing</h1>
                    <p className="login-subtitle">Manage your flower business easily</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {error && (
                        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '600', marginBottom: '12px', textAlign: 'center' }}>
                            {error}
                        </div>
                    )}
                    <div className="field-group">
                        <span className="field-icon">👤</span>
                        <input
                            type="text"
                            className="field-input"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="field-group">
                        <span className="field-icon">🔒</span>
                        <input
                            type="password"
                            className="field-input"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary btn-full ripple">
                        <span className="btn-icon">✨</span> Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
