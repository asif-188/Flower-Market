import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import Petals from '../components/Petals';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const email = username.includes('@') ? username : `${username}@poovanam.com`;
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
                alert("Account created! You can now log in.");
                setIsSignUp(false);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                navigate('/app');
            }
        } catch (error) {
            console.error("Auth Error:", error.message);
            alert(error.message);
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
                        <span className="btn-icon">✨</span> {isSignUp ? 'Register' : 'Login'}
                    </button>
                    
                    <div className="text-center pt-4">
                        <button 
                            type="button" 
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="hint-text hover:text-green-600 underline"
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


export default Login;
