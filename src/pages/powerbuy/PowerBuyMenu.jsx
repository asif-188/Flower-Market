import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { LangContext } from '../../components/Layout';
import VVLogo from '../../components/VVLogo';

const PB_COLOR = {
  primary: '#7c3aed',
  light: '#f5f3ff',
  border: '#c4b5fd',
  glow: 'rgba(124,58,237,0.15)',
};

const MENU_ITEMS = [
  {
    emoji: '🧑',
    label: 'Customer',
    color: { border: '#16a34a', text: '#16a34a', bg: '#f0fdf4', glow: 'rgba(22,163,74,0.15)' },
    route: '/app/pb-buyer',
  },
  {
    emoji: '💰',
    label: 'Cash Receive',
    color: { border: '#7c3aed', text: '#7c3aed', bg: '#f5f3ff', glow: 'rgba(124,58,237,0.15)' },
    route: '/app/pb-payments',
  },
  {
    emoji: '🧾',
    label: 'Sales',
    color: { border: '#ea580c', text: '#ea580c', bg: '#fff7ed', glow: 'rgba(234,88,12,0.15)' },
    route: '/app/pb-sales',
  },
  {
    emoji: '📈',
    label: 'Customer Report',
    color: { border: '#d97706', text: '#d97706', bg: '#fffbeb', glow: 'rgba(217,119,6,0.15)' },
    route: '/app/pb-reports',
  },
  {
    emoji: '🌸',
    label: 'Flowers',
    color: { border: '#db2777', text: '#db2777', bg: '#fdf2f8', glow: 'rgba(219,39,119,0.15)' },
    route: '/app/pb-flowers',
  },
  {
    emoji: '📂',
    label: 'Daily Report',
    color: { border: '#0d9488', text: '#0d9488', bg: '#f0fdfa', glow: 'rgba(13,148,136,0.15)' },
    route: '/app/pb-daily-report',
  },
];

const CARD_W = 280;

const MenuCard = ({ emoji, label, color, onClick }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '18px 20px',
        background: hovered ? color.bg : '#ffffff',
        border: `2.5px solid ${color.border}`,
        borderRadius: '18px',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: hovered ? 'translateY(-4px) scale(1.03)' : 'translateY(0) scale(1)',
        boxShadow: hovered
          ? `0 12px 32px ${color.glow}, 0 2px 8px rgba(0,0,0,0.06)`
          : '0 2px 8px rgba(0,0,0,0.04)',
        width: `${CARD_W}px`,
        outline: 'none',
        fontFamily: 'var(--font-display)',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: '54px', height: '54px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hovered ? '#ffffff' : '#f8fafc',
        border: '1px solid #e2e8f0', borderRadius: '12px',
        transition: 'all 0.25s',
        transform: hovered ? 'rotate(6deg) scale(1.08)' : 'none',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <span style={{ fontSize: '28px', lineHeight: 1 }}>{emoji}</span>
      </div>
      <span style={{
        fontSize: '19px',
        fontWeight: 800,
        color: color.text,
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        textAlign: 'left',
        flex: 1,
      }}>
        {label}
      </span>
    </button>
  );
};

const PowerBuyMenu = () => {
  const navigate = useNavigate();
  const row1 = MENU_ITEMS.slice(0, 3);
  const row2 = MENU_ITEMS.slice(3);

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{ position: 'absolute', top: '5%', left: '10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Floating emojis */}
      <div className="animate-float" style={{ position: 'absolute', top: '12%', left: '6%', opacity: 0.18, pointerEvents: 'none' }}><VVLogo size={32} /></div>
      <div className="animate-drift" style={{ position: 'absolute', top: '25%', right: '8%', fontSize: '36px', opacity: 0.1, pointerEvents: 'none', animationDelay: '1.5s' }}>🌸</div>
      <div className="animate-float" style={{ position: 'absolute', bottom: '25%', left: '14%', fontSize: '22px', opacity: 0.25, pointerEvents: 'none', animationDelay: '0.8s' }}>💜</div>
      <div className="animate-drift" style={{ position: 'absolute', bottom: '38%', right: '16%', fontSize: '28px', opacity: 0.1, pointerEvents: 'none', animationDelay: '2s' }}>🌺</div>

      {/* Header Banner — hidden, uncomment to restore
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '36px',
        padding: '12px 28px',
        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        borderRadius: '100px',
        boxShadow: '0 8px 32px rgba(124,58,237,0.35)',
        position: 'relative', zIndex: 10,
      }}>
        <span style={{ fontSize: '26px' }}>⚡</span>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: '22px', color: '#fff', letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          VV
        </span>
        <span style={{ fontSize: '26px' }}>⚡</span>
      </div>
      */}

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 10, padding: '16px' }}>
        {/* Row 1: 3 cards */}
        <div style={{ display: 'flex', gap: '18px', flexWrap: 'nowrap' }}>
          {row1.map((item, i) => (
            <div key={item.label} className="animate-in fade-in" style={{ animationDelay: `${i * 0.08}s`, animationDuration: '0.4s' }}>
              <MenuCard
                emoji={item.emoji}
                label={item.label}
                color={item.color}
                onClick={() => navigate(item.route)}
              />
            </div>
          ))}
        </div>
        {/* Row 2: remaining cards centered */}
        <div style={{ display: 'flex', gap: '18px', flexWrap: 'nowrap', justifyContent: 'center' }}>
          {row2.map((item, i) => (
            <div key={item.label} className="animate-in fade-in" style={{ animationDelay: `${(i + 3) * 0.08}s`, animationDuration: '0.4s' }}>
              <MenuCard
                emoji={item.emoji}
                label={item.label}
                color={item.color}
                onClick={() => navigate(item.route)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PowerBuyMenu;
