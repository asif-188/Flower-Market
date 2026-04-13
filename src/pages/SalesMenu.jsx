
import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flower2 } from 'lucide-react';
import { LangContext } from '../components/Layout';

const SalesMenu = () => {
    const navigate = useNavigate();
    const { t, lang } = useContext(LangContext);

    const MenuCard = ({ emoji, label, colorClass, icon: Icon, onClick }) => (
        <button 
            onClick={onClick}
            className={`group relative flex items-center gap-8 p-3 pr-14 bg-white border-2 rounded-full transition-all hover:scale-[1.05] active:scale-95 shadow-xl border-opacity-60 hover:shadow-2xl ${colorClass}`}
            style={{ minWidth: '420px' }}
        >
            {/* Outer Glow / Double Border */}
            <div className={`absolute inset-[-6px] border-2 rounded-[999px] opacity-20 group-hover:opacity-100 transition-opacity pointer-events-none ${colorClass}`} />
            
            {/* Icon Wrapper (Matches screenshot white square with rounded corners) */}
            <div className="w-20 h-20 flex items-center justify-center bg-gray-50/80 rounded-3xl border border-gray-100 shadow-sm transition-transform group-hover:rotate-6 group-hover:scale-110">
                 <span className="text-4xl filter drop-shadow-md">{emoji}</span>
            </div>
            
            <span className={`text-3xl font-black tracking-tighter ${colorClass.replace('border-', 'text-')} group-hover:brightness-90 font-heading`}>
                {label}
            </span>
        </button>
    );

    return (
        <div className="min-h-screen relative overflow-hidden bg-ethereal">
            {/* Beautiful Anime Decorations */}
            <div className="absolute top-[10%] left-[5%] text-4xl animate-float opacity-30 pointer-events-none">🌸</div>
            <div className="absolute top-[30%] right-[8%] text-5xl animate-drift opacity-20 pointer-events-none stagger-2">🌸</div>
            <div className="absolute bottom-[20%] left-[12%] text-3xl animate-float opacity-40 pointer-events-none stagger-3">🌼</div>
            <div className="absolute bottom-[40%] right-[15%] text-4xl animate-drift opacity-10 pointer-events-none stagger-1">🌸</div>
            <div className="absolute top-[60%] left-[25%] text-2xl animate-float opacity-15 pointer-events-none stagger-4">🌺</div>
            <div className="absolute top-[5%] right-[30%] text-6xl animate-drift opacity-5 pointer-events-none">✨</div>
            <div className="absolute top-[60%] right-[20%] opacity-10 rotate-12 text-yellow-400">🌼</div>

            {/* Menu Grid - Expanded for Full Screen */}
            <div className="relative z-10 w-full px-12 py-20 flex flex-col items-center justify-center min-h-[70vh]">
                <div className="flex flex-wrap gap-12 justify-center max-w-[1600px] w-full items-center">
                    <div className="opacity-0 animate-entry stagger-1">
                        <MenuCard 
                            emoji="🧒" 
                            label={t('customer')} 
                            colorClass="border-emerald-500"
                            onClick={() => navigate('/app/buyer')}
                        />
                    </div>
                    
                    <div className="opacity-0 animate-entry stagger-2">
                        <MenuCard 
                            emoji="💰" 
                            label={t('cashReceive')} 
                            colorClass="border-indigo-400"
                            onClick={() => navigate('/app/payments')}
                        />
                    </div>

                    <div className="opacity-0 animate-entry stagger-3">
                        <MenuCard 
                            emoji="🧾" 
                            label={t('sales')} 
                            colorClass="border-teal-700"
                            onClick={() => navigate('/app/sales-entry')}
                        />
                    </div>

                    <div className="opacity-0 animate-entry stagger-4">
                        <MenuCard 
                            emoji="📊" 
                            label={t('reports')} 
                            colorClass="border-orange-500"
                            onClick={() => navigate('/app/reports')}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesMenu;

