import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, Tag, Package, Download, Upload, Boxes } from 'lucide-react';
import { subscribeToCollection, db } from '../utils/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const Products = () => {
    const [products, setProducts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentProduct, setCurrentProduct] = useState({ id: '', name: '', price: '', unit: 'Kg' });

    useEffect(() => {
        const unsubscribe = subscribeToCollection('products', setProducts);
        return () => unsubscribe();
    }, []);

    const handleOpenModal = (product = null) => {
        if (product) {
            setCurrentProduct(product);
        } else {
            setCurrentProduct({ id: '', name: '', price: '', unit: 'Kg' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (currentProduct.id) {
                const docRef = doc(db, 'products', currentProduct.id);
                await updateDoc(docRef, currentProduct);
            } else {
                await addDoc(collection(db, 'products'), currentProduct);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving product:", error);
            alert("Failed to save product.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Delete this product?')) {
            await deleteDoc(doc(db, 'products', id));
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white rounded-[40px] shadow-2xl border border-gray-100 p-10 animate-in fade-in slide-in-from-top-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-orange-500 text-white rounded-[24px] flex items-center justify-center shadow-[0_10px_20px_-5px_rgba(249,115,22,0.4)] rotate-6">
                        <Boxes size={36} />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-gray-800 tracking-tighter italic">Product Master</h2>
                        <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">Flower Inventory & Logistics</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button className="hidden lg:flex items-center gap-2 px-6 py-3 bg-gray-50 text-gray-600 rounded-full font-bold text-sm hover:bg-gray-100 transition-colors">
                        <Download size={18} /> Export
                    </button>
                    <button 
                        onClick={() => handleOpenModal()} 
                        className="flex items-center gap-3 px-8 py-4 bg-orange-500 text-white rounded-full font-black uppercase tracking-widest text-sm hover:bg-orange-600 shadow-[0_15px_30px_-10px_rgba(249,115,22,0.5)] transform transition-all hover:-translate-y-1 active:scale-95"
                    >
                        <Plus size={20} /> Add New Flowr
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-6 mb-12 items-center">
                <div className="relative flex-1 w-full max-w-xl">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-400" size={24} />
                    <input 
                        type="text" 
                        placeholder="Search flower catalog..." 
                        className="w-full pl-16 pr-8 py-5 border-3 border-orange-50 rounded-[30px] outline-none focus:border-orange-500 focus:bg-white transition-all font-black text-gray-700 text-lg shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <span className="px-4 py-2 bg-orange-100 text-orange-600 rounded-full text-xs font-black uppercase tracking-widest">{filteredProducts.length} Items</span>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
                {filteredProducts.map((product) => (
                    <div key={product.id} className="group relative bg-gray-50/50 rounded-[40px] p-8 border-2 border-transparent hover:border-orange-500 hover:bg-white hover:shadow-2xl transition-all duration-300">
                        <div className="absolute top-6 right-6 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                            <button onClick={() => handleOpenModal(product)} className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleDelete(product.id)} className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm">
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="mb-8">
                            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-orange-500 shadow-xl border border-orange-50 group-hover:scale-110 transition-transform mb-6">
                                <Tag size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-800 tracking-tight italic mb-2">🌸 {product.name}</h3>
                            <div className="flex items-center gap-2 text-gray-400 font-bold text-xs uppercase tracking-widest pl-1">
                                <Package size={14} className="text-orange-300" />
                                Standard {product.unit} Unit
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-100">
                            <div className="bg-gray-100 px-4 py-1 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:bg-orange-50 group-hover:text-orange-400 transition-colors">Market Rate</div>
                            <div className="text-2xl font-black text-gray-800 group-hover:text-orange-600 transition-colors">
                                ₹{product.price}<span className="text-sm text-gray-400 font-bold italic ml-1">/{product.unit}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredProducts.length === 0 && (
                    <div className="col-span-full py-40 text-center opacity-20">
                         <Boxes size={120} className="mx-auto mb-6" />
                         <p className="text-2xl font-black uppercase tracking-[0.3em]">No Flowers Registered</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-lg shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] animate-in zoom-in duration-300 overflow-hidden">
                        <div className="p-10 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="text-3xl font-black text-gray-800 tracking-tighter italic">Product Intelligence</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 hover:rotate-90 transition-all">
                                <X size={32} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-12 space-y-10">
                            <div className="space-y-4">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest pl-2">Scientific / Local Flower Name</label>
                                <input 
                                    type="text" 
                                    className="w-full px-8 py-5 rounded-[24px] bg-gray-50 border-3 border-transparent focus:border-orange-500 focus:bg-white transition-all outline-none text-xl font-black text-gray-800 shadow-inner" 
                                    value={currentProduct.name}
                                    onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                    placeholder="Enter Name..."
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest pl-2">Benchmark Rate (₹)</label>
                                    <input 
                                        type="number" 
                                        className="w-full px-8 py-5 rounded-[24px] bg-gray-50 border-3 border-transparent focus:border-orange-500 focus:bg-white transition-all outline-none text-3xl font-black text-gray-800 shadow-inner" 
                                        value={currentProduct.price}
                                        onChange={(e) => setCurrentProduct({ ...currentProduct, price: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest pl-2">Measure Unit</label>
                                    <select 
                                        className="w-full px-8 py-5 rounded-[24px] bg-gray-50 border-3 border-transparent focus:border-orange-500 focus:bg-white transition-all outline-none text-xl font-black text-gray-800 shadow-inner appearance-none"
                                        value={currentProduct.unit}
                                        onChange={(e) => setCurrentProduct({ ...currentProduct, unit: e.target.value })}
                                    >
                                        <option>Kg</option>
                                        <option>Bunch</option>
                                        <option>Piece</option>
                                    </select>
                                </div>
                            </div>
                            <button 
                                type="submit" 
                                className="w-full py-8 bg-orange-500 text-white rounded-[32px] font-black text-2xl uppercase tracking-[0.2em] hover:bg-orange-600 shadow-2xl transition-all transform hover:-translate-y-2 active:scale-95 flex items-center justify-center gap-4"
                            >
                                <Save size={32} />
                                Sync Product
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;
