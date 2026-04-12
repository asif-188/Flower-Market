
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ReceiptText, Wallet, BarChart3, Flower2 } from 'lucide-react';

const SalesMenu = () => {
    const navigate = useNavigate();

    const MenuCard = ({ emoji, label, colorClass, icon: Icon, onClick }) => (
        <button 
            onClick={onClick}
            className={`group relative flex items-center gap-6 p-8 bg-white border-2 rounded-[32px] transition-all hover:scale-105 active:scale-95 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] hover:shadow-2xl ${colorClass}`}
            style={{ minWidth: '340px' }}
        >
            {/* Double Border Effect */}
            <div className="absolute inset-[-6px] border-2 rounded-[38px] opacity-30 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ borderColor: 'inherit' }}></div>
            
            <div className="w-16 h-16 flex items-center justify-center bg-gray-50 rounded-2xl group-hover:bg-white transition-colors shadow-inner">
                 <span className="text-4xl">{emoji}</span>
            </div>
            
            <div className="flex flex-col items-start leading-tight">
                <span className={`text-2xl font-black tracking-tight ${colorClass.replace('border-', 'text-')} group-hover:brightness-90`}>
                    {label}
                </span>
            </div>
        </button>
    );

    return (
        <div className="min-h-screen relative overflow-hidden bg-[#fcfdfb]">
            {/* Dot Background Pattern */}
            <div className="absolute inset-0 opacity-40 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)', 
                     backgroundSize: '24px 24px' 
                 }}></div>

            {/* Float Decorations (Simulating the petals in screenshot) */}
            <div className="absolute top-20 right-[10%] opacity-20 animate-pulse text-emerald-300">🌸</div>
            <div className="absolute bottom-40 left-[5%] opacity-20 animate-bounce text-pink-300" style={{ animationDuration: '4s' }}>🌸</div>
            <div className="absolute top-[60%] right-[20%] opacity-10 rotate-12 text-yellow-400">🌼</div>

            {/* Header Area */}
            <div className="relative z-10 w-full bg-white border-b border-gray-100 py-3 px-8 flex justify-center items-center gap-2 mb-12 shadow-sm">
                 <Flower2 className="text-emerald-600" size={24} />
                 <h1 className="text-xl font-bold text-gray-700 tracking-tight">Sales</h1>
            </div>

            {/* Menu Grid */}
            <div className="relative z-10 max-w-7xl mx-auto px-10">
                <div className="flex flex-wrap gap-12 justify-start md:justify-center mt-10">
                    <div className="border-emerald-500">
                        <MenuCard 
                            emoji="👱‍♂️" 
                            label="Customer" 
                            colorClass="border-emerald-500"
                            onClick={() => navigate('/app/buyer')}
                        />
                    </div>
                    
                    <div className="border-indigo-400">
                        <MenuCard 
                            emoji="💰" 
                            label="Cash Receive" 
                            colorClass="border-indigo-400"
                            onClick={() => navigate('/app/payments')}
                        />
                    </div>

                    <div className="border-emerald-700">
                        <MenuCard 
                            emoji="🧾" 
                            label="Sales" 
                            colorClass="border-emerald-700"
                            onClick={() => navigate('/app/sales-entry')}
                        />
                    </div>

                    <div className="border-orange-500">
                        <MenuCard 
                            emoji="📉" 
                            label="Customer Report" 
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

