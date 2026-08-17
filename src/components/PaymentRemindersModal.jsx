import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle, Clock, Calendar, User, Bell, ChevronRight, Printer, FileSpreadsheet, MessageCircle, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  subscribeToPaymentReminders, 
  savePaymentReminder, 
  updatePaymentReminder, 
  subscribeToCollection, 
  combineRemindersWithExistingSales 
} from '../utils/storage';
import { LangContext } from './Layout';
import { useTenant } from '../utils/TenantContext';

const PaymentRemindersModal = ({ isOpen, onClose }) => {
    const { lang } = useContext(LangContext);
    const { tenantData } = useTenant();
    const navigate = useNavigate();
    const [storedReminders, setStoredReminders] = useState([]);
    const [allSales, setAllSales] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [filterStatus, setFilterStatus] = useState('Active'); // 'Active', 'All', 'Completed'
    const [searchTerm, setSearchTerm] = useState('');
    const [editingDateId, setEditingDateId] = useState(null);
    const [newReminderDate, setNewReminderDate] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const u1 = subscribeToPaymentReminders(setStoredReminders);
        const u2 = subscribeToCollection('sales', setAllSales, true);
        const u3 = subscribeToCollection('buyers', setBuyers, true);
        return () => { u1(); u2(); u3(); };
    }, [isOpen]);

    // Combine explicit stored reminders with synthesized reminders from existing sales
    const combinedReminders = React.useMemo(() => {
        return combineRemindersWithExistingSales(storedReminders, allSales, buyers);
    }, [storedReminders, allSales, buyers]);

    if (!isOpen) return null;

    const filteredReminders = combinedReminders.filter(r => {
        if (filterStatus === 'Active') return (r.status === 'Pending' || r.status === 'Remind Later') && r.pendingAmount > 0;
        if (filterStatus === 'Completed') return r.status === 'Completed' || r.pendingAmount <= 0;
        return true;
    });

    // Filter further by search term
    const searchedReminders = filteredReminders.filter(r => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase().trim();
        return (
            (r.buyerName && r.buyerName.toLowerCase().includes(q)) ||
            (r.buyerId && String(r.buyerId).toLowerCase().includes(q))
        );
    });

    const handleMarkAsPaid = async (rem) => {
        try {
            if (rem.isSynthesized) {
                await savePaymentReminder({
                    saleId: rem.saleId || '',
                    buyerId: rem.buyerId,
                    buyerName: rem.buyerName,
                    salesDate: rem.salesDate,
                    reminderDate: rem.reminderDate,
                    pendingAmount: 0,
                    originalAmount: rem.originalAmount,
                    status: 'Completed'
                });
            } else {
                await updatePaymentReminder(rem.id, { status: 'Completed', pendingAmount: 0 });
            }
        } catch (err) {
            alert('Failed to mark as paid: ' + err.message);
        }
    };

    const handleRemindLaterSubmit = async (rem) => {
        if (!newReminderDate) return;
        try {
            if (rem.isSynthesized) {
                await savePaymentReminder({
                    saleId: rem.saleId || '',
                    buyerId: rem.buyerId,
                    buyerName: rem.buyerName,
                    salesDate: rem.salesDate,
                    reminderDate: newReminderDate,
                    pendingAmount: rem.pendingAmount,
                    originalAmount: rem.originalAmount,
                    status: 'Remind Later'
                });
            } else {
                await updatePaymentReminder(rem.id, {
                    reminderDate: newReminderDate,
                    status: 'Remind Later'
                });
            }
            setEditingDateId(null);
            setNewReminderDate('');
        } catch (err) {
            alert('Failed to update date: ' + err.message);
        }
    };

    const handleQuickSnooze = async (rem, days) => {
        try {
            const baseDate = rem.reminderDate ? new Date(rem.reminderDate) : new Date();
            baseDate.setDate(baseDate.getDate() + days);
            const nextDateStr = baseDate.toISOString().split('T')[0];

            if (rem.isSynthesized) {
                await savePaymentReminder({
                    saleId: rem.saleId || '',
                    buyerId: rem.buyerId,
                    buyerName: rem.buyerName,
                    salesDate: rem.salesDate,
                    reminderDate: nextDateStr,
                    pendingAmount: rem.pendingAmount,
                    originalAmount: rem.originalAmount,
                    status: 'Remind Later'
                });
            } else {
                await updatePaymentReminder(rem.id, {
                    reminderDate: nextDateStr,
                    status: 'Remind Later'
                });
            }
        } catch (err) {
            alert('Failed to snooze: ' + err.message);
        }
    };

    const handleViewCustomer = (buyerId, buyerName) => {
        onClose();
        navigate('/app/buyer', { state: { buyerId, buyerName } });
    };

    const handleSendWhatsApp = (rem) => {
        const buyer = buyers.find(b => b.id === rem.buyerId || b.name.toLowerCase() === (rem.buyerName || '').toLowerCase());
        const rawContact = buyer?.contact || rem.contact || '';

        if (!rawContact) {
            alert(`No WhatsApp contact number found for ${rem.buyerName}. Please register a phone number in Customer Directory.`);
            return;
        }

        const cleanPhone = rawContact.replace(/\D/g, '');
        const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const shopTitle = tenantData?.name || 'SVM Flowers';

        const message = lang === 'ta'
            ? `வணக்கம் ${rem.buyerName},\n\n${shopTitle} - கட்டண நினைவூட்டல்:\nகடைசி விற்பனை தேதி: ${rem.salesDate}\nமொத்த நிலுவை தொகை: ₹${Number(rem.pendingAmount).toLocaleString('en-IN')}\n\nதயவுசெய்து கட்டணத்தை விரைவில் செலுத்தவும். நன்றி!`
            : `Hello ${rem.buyerName},\n\nPayment Reminder from ${shopTitle}:\nLatest Sales Date: ${rem.salesDate}\nTotal Outstanding Balance: ₹${Number(rem.pendingAmount).toLocaleString('en-IN')}\n\nPlease clear your pending balance at your earliest convenience. Thank you!`;

        const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const handleExportExcel = () => {
        if (searchedReminders.length === 0) {
            alert('No reminders to export.');
            return;
        }
        const totalPending = searchedReminders.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0);

        const exportData = searchedReminders.map((r, index) => {
            const buyer = buyers.find(b => b.id === r.buyerId || b.name.toLowerCase() === (r.buyerName || '').toLowerCase());
            return {
                'S.No': index + 1,
                'Customer Name': r.buyerName || 'Customer',
                'Contact Number': buyer?.contact || '',
                'Latest Sales Date': r.salesDate || '',
                'Pending Amount (INR)': Number(r.pendingAmount || 0),
                'Status': r.status || 'Pending'
            };
        });

        // Add Total Pending Amount summary row
        exportData.push({
            'S.No': '',
            'Customer Name': 'TOTAL PENDING AMOUNT',
            'Contact Number': '',
            'Latest Sales Date': '',
            'Pending Amount (INR)': totalPending,
            'Status': ''
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment_Reminders');
        const today = new Date().toISOString().split('T')[0];
        const searchSuffix = searchTerm ? `_${searchTerm.trim().replace(/\s+/g, '_')}` : '';
        XLSX.writeFile(workbook, `Payment_Reminders_${filterStatus}${searchSuffix}_${today}.xlsx`);
    };

    const handlePrint = () => {
        if (searchedReminders.length === 0) {
            alert('No reminders to print.');
            return;
        }
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const totalPending = searchedReminders.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0);
        const today = new Date().toLocaleDateString('en-IN');
        const rowsHtml = searchedReminders.map((r, i) => {
            const buyer = buyers.find(b => b.id === r.buyerId || b.name.toLowerCase() === (r.buyerName || '').toLowerCase());
            return `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${r.buyerName || 'Customer'}</strong></td>
                    <td>${buyer?.contact || '—'}</td>
                    <td>${r.salesDate || '—'}</td>
                    <td style="text-align: right; color: #dc2626; font-weight: bold;">₹${Number(r.pendingAmount || 0).toLocaleString('en-IN')}</td>
                    <td>${r.status}</td>
                </tr>
            `;
        }).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Reminders Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
                    h2 { color: #16a34a; margin-bottom: 4px; }
                    p { color: #64748b; font-size: 13px; margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 13px; text-align: left; }
                    th { background-color: #f1f5f9; color: #16a34a; text-transform: uppercase; font-size: 11px; }
                    tr.total-row td { background-color: #f0fdf4; border-top: 2px solid #16a34a; font-weight: bold; font-size: 14px; }
                    .footer { margin-top: 20px; font-size: 12px; color: #94a3b8; text-align: right; }
                </style>
            </head>
            <body>
                <h2>${tenantData?.name || 'SVM Flowers'} — Payment Reminders Report</h2>
                <p>Filter: ${filterStatus} ${searchTerm ? `| Customer Search: "${searchTerm}"` : ''} | Date: ${today} | Total Records: ${searchedReminders.length}</p>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Customer Name</th>
                            <th>Contact</th>
                            <th>Latest Sales Date</th>
                            <th style="text-align: right;">Pending Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="total-row">
                            <td colspan="4" style="text-align: right; text-transform: uppercase; color: #15803d;">Total Pending Amount:</td>
                            <td style="text-align: right; color: #dc2626; font-size: 15px; font-weight: 900;">₹${totalPending.toLocaleString('en-IN')}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
                <div class="footer">Generated on ${new Date().toLocaleString('en-IN')}</div>
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
            <div style={{
                background: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '720px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1.5px solid #e2e8f0',
                display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden',
                animation: 'in 0.2s ease-out'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1.5px solid #f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '42px', height: '42px', borderRadius: '14px',
                            background: '#dcfce7', border: '1.5px solid #86efac',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#16a34a'
                        }}>
                            <Bell size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'var(--font-display)' }}>
                                {lang === 'ta' ? 'கட்டண விழிப்பூட்டல்கள்' : 'Payment Reminders'}
                            </h2>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', margin: 0 }}>
                                {lang === 'ta' ? 'அனைத்து விற்பனை மற்றும் நிலுவை நினைவூட்டல்கள்' : 'Active & Existing Pending Reminders'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '34px', height: '34px', borderRadius: '10px', background: '#f8fafc',
                            border: '1.5px solid #e2e8f0', color: '#64748b', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => Object.assign(e.currentTarget.style, { background: '#fee2e2', color: '#ef4444', borderColor: '#fca5a5' })}
                        onMouseLeave={e => Object.assign(e.currentTarget.style, { background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' })}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Filter Tabs & Export Buttons */}
                <div style={{ padding: '12px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { id: 'Active', label: lang === 'ta' ? 'செயலில் உள்ளவை' : 'Active Pending' },
                            { id: 'All', label: lang === 'ta' ? 'அனைத்தும்' : 'All Reminders' },
                            { id: 'Completed', label: lang === 'ta' ? 'முடிவடைந்தது' : 'Completed' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setFilterStatus(tab.id)}
                                style={{
                                    padding: '6px 14px', borderRadius: '100px', fontSize: '12px', fontWeight: 700,
                                    cursor: 'pointer', border: '1.5px solid', transition: 'all 0.15s',
                                    background: filterStatus === tab.id ? '#16a34a' : '#ffffff',
                                    color: filterStatus === tab.id ? '#ffffff' : '#64748b',
                                    borderColor: filterStatus === tab.id ? '#16a34a' : '#cbd5e1',
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={handlePrint}
                            style={{
                                padding: '6px 12px', borderRadius: '8px', background: '#ffffff',
                                border: '1.5px solid #cbd5e1', color: '#334155', fontSize: '12px',
                                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
                            }}
                        >
                            <Printer size={14} color="#16a34a" /> Print
                        </button>
                        <button
                            onClick={handleExportExcel}
                            style={{
                                padding: '6px 12px', borderRadius: '8px', background: '#f0fdf4',
                                border: '1.5px solid #86efac', color: '#15803d', fontSize: '12px',
                                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
                            }}
                        >
                            <FileSpreadsheet size={14} color="#16a34a" /> Export Excel
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div style={{ padding: '10px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={lang === 'ta' ? 'வாடிக்கையாளர் பெயர் அல்லது ஐடி மூலம் தேடுக...' : 'Search customer name or ID...'}
                            style={{
                                width: '100%', padding: '9px 14px 9px 38px', borderRadius: '12px',
                                border: '1.5px solid #cbd5e1', background: '#f8fafc', fontSize: '13px',
                                fontWeight: 600, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)',
                                transition: 'all 0.2s'
                            }}
                            onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#ffffff'; }}
                            onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.background = '#f8fafc'; }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Reminders List */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {searchedReminders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                            <Bell size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <div style={{ fontSize: '14px', fontWeight: 700 }}>
                                {lang === 'ta' ? 'நினைவூட்டல்கள் எதுவும் இல்லை' : 'No payment reminders found'}
                            </div>
                        </div>
                    ) : (
                        searchedReminders.map((rem) => {
                            const isOverdue = rem.status !== 'Completed' && new Date(rem.reminderDate) < new Date(new Date().toISOString().split('T')[0]);
                            const isToday = rem.status !== 'Completed' && rem.reminderDate === new Date().toISOString().split('T')[0];

                            return (
                                <div
                                    key={rem.id}
                                    style={{
                                        background: '#ffffff', borderRadius: '16px', border: '1.5px solid',
                                        borderColor: rem.status === 'Completed' ? '#e2e8f0' : isOverdue ? '#fca5a5' : isToday ? '#fde047' : '#cbd5e1',
                                        padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                        display: 'flex', flexDirection: 'column', gap: '12px'
                                    }}
                                >
                                    {/* Item Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '38px', height: '38px', borderRadius: '50%', background: '#f1f5f9',
                                                border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, color: '#475569'
                                            }}>
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                                                    {rem.buyerName || 'Customer'}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                                                    {lang === 'ta' ? 'கடைசி விற்பனை தேதி' : 'Latest Sales Date'}: <span style={{ fontWeight: 700, color: '#334155' }}>{rem.salesDate}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            <div style={{ fontSize: '18px', fontWeight: 900, color: rem.status === 'Completed' ? '#16a34a' : '#dc2626' }}>
                                                {fmt(rem.pendingAmount)}
                                            </div>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 800,
                                                background: rem.status === 'Completed' ? '#dcfce7' : rem.status === 'Remind Later' ? '#e0f2fe' : '#fef3c7',
                                                color: rem.status === 'Completed' ? '#15803d' : rem.status === 'Remind Later' ? '#0369a1' : '#b45309'
                                            }}>
                                                {rem.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                        {rem.status !== 'Completed' && (
                                            <button
                                                onClick={() => handleMarkAsPaid(rem)}
                                                style={{
                                                    flex: 1, padding: '9px 14px', borderRadius: '10px', background: '#16a34a',
                                                    color: '#ffffff', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                                                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <CheckCircle size={14} />
                                                {lang === 'ta' ? 'செலுத்தப்பட்டது என குறிக்கவும்' : 'Mark as Paid'}
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleSendWhatsApp(rem)}
                                            style={{
                                                padding: '9px 14px', borderRadius: '10px', background: '#25D366',
                                                color: '#ffffff', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                                                border: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                                                boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)'
                                            }}
                                            title="Send WhatsApp Reminder"
                                        >
                                            <MessageCircle size={14} /> WhatsApp
                                        </button>

                                        <button
                                            onClick={() => handleViewCustomer(rem.buyerId, rem.buyerName)}
                                            style={{
                                                padding: '9px 14px', borderRadius: '10px', background: '#f8fafc',
                                                border: '1.5px solid #cbd5e1', color: '#475569', fontSize: '12px',
                                                fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                        >
                                            <User size={14} /> {lang === 'ta' ? 'வாடிக்கையாளரைப் பார்' : 'View Customer'}
                                        </button>
                                    </div>

                                    {rem.status === 'Completed' && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                            <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <CheckCircle size={14} /> Reminder Completed
                                            </div>
                                            <button
                                                onClick={() => handleViewCustomer(rem.buyerId)}
                                                style={{
                                                    padding: '4px 8px', borderRadius: '6px', background: '#f8fafc',
                                                    border: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px',
                                                    fontWeight: 700, cursor: 'pointer'
                                                }}
                                            >
                                                View Customer
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentRemindersModal;
