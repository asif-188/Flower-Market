import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Save, Printer } from 'lucide-react';
import { subscribeToCollection, saveSale } from '../utils/storage';

const DirectSales = () => {
    const [flowers, setFlowers] = useState([]);
    const [cart, setCart] = useState([]);
    const [currentItem, setCurrentItem] = useState({ flowerType: '', quantity: '', price: '' });

    useEffect(() => {
        const unsubscribe = subscribeToCollection('products', (data) => {
            setFlowers(data.map(p => p.name));
        });
        return () => unsubscribe();
    }, []);

    const addToCart = (e) => {
        e.preventDefault();
        if (!currentItem.flowerType || !currentItem.quantity || !currentItem.price) return;

        const total = parseFloat(currentItem.quantity) * parseFloat(currentItem.price);
        setCart([...cart, { ...currentItem, id: Date.now(), total }]);
        setCurrentItem({ flowerType: '', quantity: '', price: '' });
    };

    const grandTotal = cart.reduce((sum, item) => sum + item.total, 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        try {
            await saveSale({
                buyerName: 'Direct Cash Customer',
                buyerId: 'direct',
                items: cart,
                grandTotal,
                date: new Date().toISOString().split('T')[0]
            });
            alert('Cash Sale Recorded!');
            setCart([]);
        } catch (error) {
            alert('Failed to save sale');
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Tag className="text-orange-500" />
                        Quick Cash Sale
                    </h2>
                    <form onSubmit={addToCart} className="space-y-4">
                        <select 
                            className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500"
                            value={currentItem.flowerType}
                            onChange={e => setCurrentItem({...currentItem, flowerType: e.target.value})}
                            required
                        >
                            <option value="">Select Flower...</option>
                            {flowers.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-4">
                            <input 
                                type="number" 
                                placeholder="Quantity" 
                                className="p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 font-bold"
                                value={currentItem.quantity}
                                onChange={e => setCurrentItem({...currentItem, quantity: e.target.value})}
                                required
                            />
                            <input 
                                type="number" 
                                placeholder="Price" 
                                className="p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 font-bold"
                                value={currentItem.price}
                                onChange={e => setCurrentItem({...currentItem, price: e.target.value})}
                                required
                            />
                        </div>
                        <button type="submit" className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-100">
                            <Plus size={20} /> Add to Cart
                        </button>
                    </form>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm min-h-[400px] flex flex-col">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex justify-between">
                        Cart Summary
                        <span className="text-orange-500">₹{grandTotal.toFixed(2)}</span>
                    </h3>
                    
                    <div className="flex-1 space-y-4">
                        {cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                                <div>
                                    <p className="font-bold text-gray-800">{item.flowerType}</p>
                                    <p className="text-sm text-gray-500">{item.quantity} units x ₹{item.price}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <p className="font-bold text-gray-800">₹{item.total.toFixed(2)}</p>
                                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-500">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 border-t border-gray-100 space-y-4">
                        <button 
                            onClick={handleCheckout}
                            disabled={cart.length === 0}
                            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest disabled:bg-gray-200 disabled:cursor-not-allowed shadow-lg shadow-emerald-50"
                        >
                            Confirm Quick Sale
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DirectSales;
