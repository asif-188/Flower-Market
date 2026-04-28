import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import Petals from '../components/Petals';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);

        // Map short username to email for Firebase Auth
        const email = username.includes('@') ? username : `${username.toLowerCase()}@poovanam.com`;
        
        try {
        // Derive tenantId: always use only the part before '@' for consistency
            const tenantId = username.includes('@') ? username.split('@')[0].toLowerCase() : username.toLowerCase();
            await signInWithEmailAndPassword(auth, email, password);
            sessionStorage.setItem('fm_tenantId', tenantId);
            navigate('/app');
        } catch (err) {
            console.error('Login error:', err);
            setError('Invalid username or password.');
        } finally {
            setIsLoggingIn(false);
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
                    <button type="submit" disabled={isLoggingIn} className={`btn-primary btn-full ripple ${isLoggingIn ? 'opacity-70 cursor-not-allowed' : ''}`}>
                        <span className="btn-icon">✨</span> {isLoggingIn ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
