import React from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] w-full animate-in fade-in zoom-in duration-500">
            <div className="text-center mb-12">
                <h1 className="text-5xl md:text-6xl font-black text-emerald-600 tracking-tighter italic flex items-center justify-center gap-3">
                    <span className="text-5xl">🌿</span> Sakura Market
                </h1>
                <p className="text-gray-400 font-bold uppercase tracking-[0.3em] text-xs mt-2">Premium Operating System</p>
            </div>

            <div className="flex flex-col gap-8 w-full max-w-lg">
                <button 
                    onClick={() => navigate('/app/farmer')}
                    className="group relative overflow-hidden bg-emerald-50 border-4 border-emerald-200 hover:border-emerald-400 p-10 rounded-[40px] shadow-2xl hover:shadow-emerald-200 transition-all transform hover:-translate-y-2 active:scale-95 flex items-center justify-center gap-8"
                >
                    <div className="text-6xl group-hover:rotate-12 transition-transform">🤠</div>
                    <span className="text-5xl font-black text-emerald-800 tracking-tighter italic">Farmer</span>
                </button>

                <button 
                    onClick={() => navigate('/app/sales')}
                    className="group relative overflow-hidden bg-indigo-50 border-4 border-indigo-100 hover:border-indigo-300 p-10 rounded-[40px] shadow-2xl hover:shadow-indigo-200 transition-all transform hover:-translate-y-2 active:scale-95 flex items-center justify-center gap-8"
                >
                    <div className="text-6xl group-hover:rotate-12 transition-transform">🧾</div>
                    <span className="text-5xl font-black text-indigo-700 tracking-tighter italic">Sales</span>
                </button>
            </div>

            <div className="mt-20 flex gap-12 opacity-40 hover:opacity-100 transition-opacity">
                <button onClick={() => navigate('/app/accounts')} className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-emerald-600">Audit Accounts</button>
                <button onClick={() => navigate('/app/buyer')} className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-emerald-600">Customer Directory</button>
                <button onClick={() => navigate('/app/products')} className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-emerald-600">Product Master</button>
            </div>
        </div>
    );
};

export default Dashboard;


