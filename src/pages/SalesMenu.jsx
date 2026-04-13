import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { LangContext } from '../components/Layout';

const MENU_ITEMS = [
    {
        emoji: '🧑',
        labelKey: 'customer',
        color: { border: '#16a34a', text: '#16a34a', bg: '#f0fdf4', glow: 'rgba(22,163,74,0.15)' },
        route: '/app/buyer',
    },
    {
        emoji: '💰',
        labelKey: 'cashReceive',
        color: { border: '#7c3aed', text: '#7c3aed', bg: '#faf5ff', glow: 'rgba(124,58,237,0.15)' },
        route: '/app/payments',
    },
    {
        emoji: '🧾',
        labelKey: 'sales',
        color: { border: '#2563eb', text: '#2563eb', bg: '#eff6ff', glow: 'rgba(37,99,235,0.15)' },
        route: '/app/sales-entry',
    },
    {
        emoji: '📈',
        labelKey: 'reports',
        color: { border: '#d97706', text: '#d97706', bg: '#fffbeb', glow: 'rgba(217,119,6,0.15)' },
        route: '/app/reports',
    },
    {
        emoji: '🌸',
        labelKey: 'flowers',
        color: { border: '#db2777', text: '#db2777', bg: '#fdf2f8', glow: 'rgba(219,39,119,0.15)' },
        route: '/app/flowers',
    },
    {
        emoji: '📂',
        labelKey: 'dailyReport',
        color: { border: '#4f46e5', text: '#4f46e5', bg: '#f5f3ff', glow: 'rgba(79,70,229,0.15)' },
        route: '/app/daily-report',
    },
];

const CARD_W = 280; // slightly wider to fit "Customer Report" on one line if possible

const MenuCard = ({ emoji, label, color, onClick, delay }) => {
    const [hovered, setHovered] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px', // slightly smaller gap to give more room to text
                padding: '18px 20px', // slightly smaller horizontal padding
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
                animationDelay: delay,
                flexShrink: 0,
            }}
        >
            {/* Icon */}
            <div style={{
                width: '54px', height: '54px', flexShrink: 0, // slightly smaller icon
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: hovered ? '#ffffff' : '#f8fafc',
                border: '1px solid #e2e8f0', borderRadius: '12px',
                transition: 'all 0.25s',
                transform: hovered ? 'rotate(6deg) scale(1.08)' : 'none',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
                <span style={{ fontSize: '28px', lineHeight: 1 }}>{emoji}</span>
            </div>

            {/* Label — removed nowrap to allow wrapping if needed */}
            <span style={{
                fontSize: '19px', // slightly smaller font
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

const SalesMenu = () => {
    const navigate = useNavigate();
    const { t } = useContext(LangContext);

    // Split into rows: 3 on top, 2 centered on bottom
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
            <div style={{ position:'absolute', top:'5%', left:'10%', width:'300px', height:'300px', background:'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />
            <div style={{ position:'absolute', bottom:'10%', right:'10%', width:'350px', height:'350px', background:'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />

            {/* Floating emojis */}
            <div className="animate-float" style={{position:'absolute',top:'12%',left:'6%',fontSize:'28px',opacity:0.25,pointerEvents:'none'}}>🌸</div>
            <div className="animate-drift" style={{position:'absolute',top:'25%',right:'8%',fontSize:'36px',opacity:0.12,pointerEvents:'none',animationDelay:'1.5s'}}>🌸</div>
            <div className="animate-float" style={{position:'absolute',bottom:'25%',left:'14%',fontSize:'22px',opacity:0.3,pointerEvents:'none',animationDelay:'0.8s'}}>🌼</div>
            <div className="animate-drift" style={{position:'absolute',bottom:'38%',right:'16%',fontSize:'28px',opacity:0.1,pointerEvents:'none',animationDelay:'2s'}}>🌺</div>

            {/* Cards — two rows, manually centered */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 10, padding: '16px' }}>
                {/* Row 1: 3 cards */}
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'nowrap' }}>
                    {row1.map((item, i) => (
                        <div key={item.labelKey} className="animate-in fade-in" style={{ animationDelay: `${i * 0.08}s`, animationDuration: '0.4s' }}>
                            <MenuCard
                                emoji={item.emoji}
                                label={t(item.labelKey)}
                                color={item.color}
                                onClick={() => navigate(item.route)}
                                delay={`${i * 0.08}s`}
                            />
                        </div>
                    ))}
                </div>

                {/* Row 2: remaining cards centered */}
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'nowrap', justifyContent: 'center' }}>
                    {row2.map((item, i) => (
                        <div key={item.labelKey} className="animate-in fade-in" style={{ animationDelay: `${(i + 3) * 0.08}s`, animationDuration: '0.4s' }}>
                            <MenuCard
                                emoji={item.emoji}
                                label={t(item.labelKey)}
                                color={item.color}
                                onClick={() => navigate(item.route)}
                                delay={`${(i + 3) * 0.08}s`}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SalesMenu;
