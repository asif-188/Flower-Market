import React, { useState } from 'react';
import VVLogo from './VVLogo';

const CORRECT_PASSWORD = 'SVM2026';

const VVPowerBuyGuard = ({ children }) => {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setUnlocked(true);
    } else {
      setError('Incorrect password. Please try again.');
      setShake(true);
      setPassword('');
      setTimeout(() => setShake(false), 600);
    }
  };

  if (unlocked) return children;

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{ position: 'absolute', top: '5%', left: '10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(251,191,36,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(217,119,6,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div
        style={{
          background: '#fff',
          borderRadius: '28px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.12), 0 4px 16px rgba(251,191,36,0.15)',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '420px',
          border: '1.5px solid #fde68a',
          position: 'relative',
          zIndex: 10,
          animation: shake ? 'vv-shake 0.5s ease' : 'none',
        }}
      >
        <style>{`
          @keyframes vv-shake {
            0%, 100% { transform: translateX(0); }
            15% { transform: translateX(-10px); }
            30% { transform: translateX(10px); }
            45% { transform: translateX(-8px); }
            60% { transform: translateX(8px); }
            75% { transform: translateX(-4px); }
            90% { transform: translateX(4px); }
          }
        `}</style>

        {/* Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '90px', height: '64px',
            background: 'linear-gradient(135deg, #1a1a1a, #2d2d2d)',
            borderRadius: '20px',
            border: '2px solid #d4a017',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(212,160,23,0.35)',
            padding: '8px 12px',
          }}>
            <VVLogo size={40} />
          </div>
          <h2 style={{
            fontSize: '26px',
            fontWeight: 900,
            color: '#92400e',
            margin: '0 0 6px 0',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.02em',
          }}>
            VV
          </h2>
          <p style={{
            fontSize: '13px',
            color: '#92400e',
            opacity: 0.65,
            margin: 0,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            🔐 Password Protected
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: '#78350f',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '8px',
            }}>
              Enter Password
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '14px 18px',
                borderRadius: '14px',
                border: error ? '2px solid #ef4444' : '2px solid #fde68a',
                background: '#fffbeb',
                fontSize: '18px',
                fontWeight: 700,
                color: '#1e293b',
                outline: 'none',
                letterSpacing: '0.15em',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#d97706'}
              onBlur={e => e.target.style.borderColor = error ? '#ef4444' : '#fde68a'}
            />
            {error && (
              <p style={{
                fontSize: '12px',
                color: '#ef4444',
                fontWeight: 600,
                marginTop: '8px',
                margin: '8px 0 0 4px',
              }}>
                ⚠️ {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-display)',
              boxShadow: '0 8px 24px rgba(217,119,6,0.35)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(217,119,6,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(217,119,6,0.35)'; }}
          >
            🔓 Unlock VV
          </button>
        </form>
      </div>
    </div>
  );
};

export default VVPowerBuyGuard;
