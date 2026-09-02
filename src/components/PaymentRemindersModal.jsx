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
import { openWhatsAppDirect, formatDateDDMMYYYY } from '../utils/whatsappHelper';

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
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [batchQueue, setBatchQueue] = useState([]);
    const [batchIndex, setBatchIndex] = useState(0);
    const [isBatchSenderOpen, setIsBatchSenderOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const u1 = subscribeToPaymentReminders(setStoredReminders);
        const u2 = subscribeToCollection('sales', setAllSales, true);
        const u3 = subscribeToCollection('buyers', setBuyers, true);
        return () => { u1(); u2(); u3(); };
    }, [isOpen]);

    // Reset selection when filter status changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [filterStatus]);

    // Combine explicit stored reminders with synthesized reminders from existing sales
    const combinedReminders = React.useMemo(() => {
        return combineRemindersWithExistingSales(storedReminders, allSales, buyers);
    }, [storedReminders, allSales, buyers]);

    const filteredReminders = combinedReminders.filter(r => {
        if (filterStatus === 'Active') return (r.status === 'Pending' || r.status === 'Remind Later') && r.pendingAmount > 0;
        if (filterStatus === 'Completed') return r.status === 'Completed' || r.pendingAmount <= 0;
        return true;
    });

    const getBuyerDisplayName = (rem) => {
        const buyer = buyers.find(b => b.id === rem.buyerId || (b.name && b.name.toLowerCase() === (rem.buyerName || '').toLowerCase()));
        if (lang === 'ta') {
            return buyer?.nameTa || buyer?.taName || rem.buyerNameTa || rem.buyerName || 'வாடிக்கையாளர்';
        }
        return buyer?.name || rem.buyerName || 'Customer';
    };

    // Filter further by search term
    const searchedReminders = filteredReminders.filter(r => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase().trim();
        const displayName = getBuyerDisplayName(r);
        return (
            (displayName && displayName.toLowerCase().includes(q)) ||
            (r.buyerName && r.buyerName.toLowerCase().includes(q)) ||
            (r.buyerId && String(r.buyerId).toLowerCase().includes(q))
        );
    });

    const selectedCount = searchedReminders.filter(r => selectedIds.has(r.id)).length;

    if (!isOpen) return null;

    // Selection handlers
    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const isAllSelected = searchedReminders.length > 0 && searchedReminders.every(r => selectedIds.has(r.id));

    const handleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(searchedReminders.map(r => r.id)));
        }
    };

    const startBatchSendWhatsApp = (isSelectedOnly = false) => {
        let items = isSelectedOnly 
            ? searchedReminders.filter(r => selectedIds.has(r.id))
            : (selectedCount > 0 ? searchedReminders.filter(r => selectedIds.has(r.id)) : searchedReminders);

        if (items.length === 0) {
            alert(lang === 'ta' ? 'அனுப்ப நினைவூட்டல்கள் எதுவும் இல்லை/தேர்ந்தெடுக்கப்படவில்லை.' : 'No reminders selected/found to send.');
            return;
        }

        const validItems = items.filter(rem => {
            const buyer = buyers.find(b => b.id === rem.buyerId || (b.name && b.name.toLowerCase() === (rem.buyerName || '').toLowerCase()));
            return !!(buyer?.contact || rem.contact);
        });

        if (validItems.length === 0) {
            alert(lang === 'ta' 
                ? 'தேர்ந்தெடுக்கப்பட்ட வாடிக்கையாளர்களுக்கு வாட்ஸ்அப் தொடர்பு எண் இல்லை. வாடிக்கையாளர் பட்டியலில் எண்களைப் பதிவு செய்யவும்.' 
                : 'None of the selected customers have a WhatsApp contact number registered.');
            return;
        }

        if (validItems.length < items.length) {
            const missingCount = items.length - validItems.length;
            alert(lang === 'ta' 
                ? `${missingCount} வாடிக்கையாளர்களுக்கு தொடர்பு எண் இல்லை. மீதமுள்ள ${validItems.length} நபர்களுக்கு வாட்ஸ்அப் அனுப்பப்படும்.`
                : `${missingCount} customer(s) do not have a contact number. Proceeding with remaining ${validItems.length} customer(s).`);
        }

        if (validItems.length === 1) {
            handleSendWhatsApp(validItems[0]);
            return;
        }

        setBatchQueue(validItems);
        setBatchIndex(0);
        setIsBatchSenderOpen(true);
    };

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

    const handleSendWhatsApp = async (rem) => {
        const buyer = buyers.find(b => b.id === rem.buyerId || (b.name && b.name.toLowerCase() === (rem.buyerName || '').toLowerCase()));
        const rawContact = buyer?.contact || rem.contact || '';
        const customerDisplayName = getBuyerDisplayName(rem);

        if (!rawContact) {
            alert(lang === 'ta' 
                ? `${customerDisplayName} வாடிக்கையாளருக்கு வாட்ஸ்அப் தொடர்பு எண் இல்லை. வாடிக்கையாளர் பட்டியலில் எண்ணைப் பதிவு செய்யவும்.` 
                : `No WhatsApp contact number found for ${customerDisplayName}. Please register a phone number in Customer Directory.`);
            return;
        }

        const shopTitle = tenantData?.name || 'SVM Flowers';
        const formattedSalesDate = formatDateDDMMYYYY(rem.salesDate);

        const message = lang === 'ta'
            ? `வணக்கம் ${customerDisplayName},\n\n${shopTitle} - கட்டண நினைவூட்டல்:\nகடைசி விற்பனை தேதி: ${formattedSalesDate}\nமொத்த நிலுவை தொகை: ₹${Number(rem.pendingAmount).toLocaleString('en-IN')}\n\nதயவுசெய்து கட்டணத்தை விரைவில் செலுத்தவும். நன்றி!`
            : `Hello ${customerDisplayName},\n\nPayment Reminder from ${shopTitle}:\nLatest Sales Date: ${formattedSalesDate}\nTotal Outstanding Balance: ₹${Number(rem.pendingAmount).toLocaleString('en-IN')}\n\nPlease clear your pending balance at your earliest convenience. Thank you!`;

        await openWhatsAppDirect({
            phone: rawContact,
            text: message
        });
    };

    const handleExportExcel = (isSelectedOnly = false) => {
        let itemsToExport = isSelectedOnly
            ? searchedReminders.filter(r => selectedIds.has(r.id))
            : (selectedCount > 0 ? searchedReminders.filter(r => selectedIds.has(r.id)) : searchedReminders);

        if (itemsToExport.length === 0) {
            alert(lang === 'ta' ? 'ஏற்றுமதி செய்ய நினைவூட்டல்கள் எதுவும் இல்லை/தேர்ந்தெடுக்கப்படவில்லை.' : 'No reminders selected/found to export.');
            return;
        }
        const isTa = lang === 'ta';
        const totalPending = itemsToExport.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0);

        const exportData = itemsToExport.map((r, index) => {
            const buyer = buyers.find(b => b.id === r.buyerId || (b.name && b.name.toLowerCase() === (r.buyerName || '').toLowerCase()));
            const customerName = getBuyerDisplayName(r);
            const statusLabel = isTa
                ? (r.status === 'Completed' ? 'முடிவடைந்தது' : r.status === 'Remind Later' ? 'பின்னர் நினைவூட்டு' : 'நிலுவையில் உள்ளது')
                : (r.status || 'Pending');

            return {
                [isTa ? 'வ.எண்' : 'S.No']: index + 1,
                [isTa ? 'வாடிக்கையாளர் பெயர்' : 'Customer Name']: customerName,
                [isTa ? 'தொடர்பு எண்' : 'Contact Number']: buyer?.contact || '',
                [isTa ? 'கடைசி விற்பனை தேதி' : 'Latest Sales Date']: formatDateDDMMYYYY(r.salesDate) || '',
                [isTa ? 'நிலுவை தொகை (ரூ)' : 'Pending Amount (INR)']: Number(r.pendingAmount || 0),
                [isTa ? 'நிலை' : 'Status']: statusLabel
            };
        });

        // Add Total Pending Amount summary row
        exportData.push({
            [isTa ? 'வ.எண்' : 'S.No']: '',
            [isTa ? 'வாடிக்கையாளர் பெயர்' : 'Customer Name']: isTa ? 'மொத்த நிலுவை தொகை' : 'TOTAL PENDING AMOUNT',
            [isTa ? 'தொடர்பு எண்' : 'Contact Number']: '',
            [isTa ? 'கடைசி விற்பனை தேதி' : 'Latest Sales Date']: '',
            [isTa ? 'நிலுவை தொகை (ரூ)' : 'Pending Amount (INR)']: totalPending,
            [isTa ? 'நிலை' : 'Status']: ''
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        const sheetName = isTa ? 'கட்டண_நினைவூட்டல்கள்' : 'Payment_Reminders';
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        const today = new Date().toISOString().split('T')[0];
        const searchSuffix = searchTerm ? `_${searchTerm.trim().replace(/\s+/g, '_')}` : '';
        const selectSuffix = isSelectedOnly || selectedCount > 0 ? '_Selected' : '_All';
        XLSX.writeFile(workbook, `${sheetName}_${filterStatus}${selectSuffix}${searchSuffix}_${today}.xlsx`);
    };

    const handlePrint = (targetItems = null, isSelectedOnly = false) => {
        let itemsToPrint = targetItems;
        if (!itemsToPrint) {
            if (isSelectedOnly) {
                itemsToPrint = searchedReminders.filter(r => selectedIds.has(r.id));
            } else {
                itemsToPrint = searchedReminders;
            }
        }

        if (!itemsToPrint || itemsToPrint.length === 0) {
            alert(lang === 'ta' ? 'அச்சிட நினைவூட்டல்கள் எதுவும் இல்லை/தேர்ந்தெடுக்கப்படவில்லை.' : 'No reminders selected/found to print.');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const isTa = lang === 'ta';
        const totalPending = itemsToPrint.reduce((sum, r) => sum + (Number(r.pendingAmount) || 0), 0);
        const today = new Date().toLocaleDateString(isTa ? 'ta-IN' : 'en-IN');
        const rowsHtml = itemsToPrint.map((r, i) => {
            const buyer = buyers.find(b => b.id === r.buyerId || (b.name && b.name.toLowerCase() === (r.buyerName || '').toLowerCase()));
            const customerName = getBuyerDisplayName(r);
            const statusLabel = isTa
                ? (r.status === 'Completed' ? 'முடிவடைந்தது' : r.status === 'Remind Later' ? 'பின்னர் நினைவூட்டு' : 'நிலுவையில் உள்ளது')
                : r.status;

            return `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${customerName}</strong></td>
                    <td>${buyer?.contact || '—'}</td>
                    <td>${formatDateDDMMYYYY(r.salesDate) || '—'}</td>
                    <td style="text-align: right; color: #dc2626; font-weight: bold;">₹${Number(r.pendingAmount || 0).toLocaleString('en-IN')}</td>
                    <td>${statusLabel}</td>
                </tr>
            `;
        }).join('');

        const typeTitle = isSelectedOnly 
            ? (isTa ? 'தேர்ந்தெடுக்கப்பட்ட கட்டண நினைவூட்டல்கள்' : 'Selected Payment Reminders')
            : (isTa ? 'அனைத்து கட்டண நினைவூட்டல்கள்' : 'All Payment Reminders');

        const titleText = `${tenantData?.name || 'SVM Flowers'} — ${typeTitle}`;
        const filterLabelMap = {
            'Active': isTa ? 'செயலில் உள்ளவை' : 'Active Pending',
            'All': isTa ? 'அனைத்தும்' : 'All Reminders',
            'Completed': isTa ? 'முடிவடைந்தது' : 'Completed'
        };

        const filterStr = `${isTa ? 'வடிகட்டி' : 'Filter'}: ${filterLabelMap[filterStatus] || filterStatus} ${searchTerm ? `| ${isTa ? 'வாடிக்கையாளர் தேடல்' : 'Search'}: "${searchTerm}"` : ''} | ${isTa ? 'தேதி' : 'Date'}: ${today} | ${isTa ? 'மொத்த பதிவுகள்' : 'Total Records'}: ${itemsToPrint.length}`;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${typeTitle}</title>
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
                <h2>${titleText}</h2>
                <p>${filterStr}</p>
                <table>
                    <thead>
                        <tr>
                            <th>${isTa ? 'வ.எண்' : '#'}</th>
                            <th>${isTa ? 'வாடிக்கையாளர் பெயர்' : 'Customer Name'}</th>
                            <th>${isTa ? 'தொடர்பு எண்' : 'Contact'}</th>
                            <th>${isTa ? 'கடைசி விற்பனை தேதி' : 'Latest Sales Date'}</th>
                            <th style="text-align: right;">${isTa ? 'நிலுவை தொகை' : 'Pending Amount'}</th>
                            <th>${isTa ? 'நிலை' : 'Status'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="total-row">
                            <td colspan="4" style="text-align: right; text-transform: uppercase; color: #15803d;">${isTa ? 'மொத்த நிலுவை தொகை' : 'Total Pending Amount'}:</td>
                            <td style="text-align: right; color: #dc2626; font-size: 15px; font-weight: 900;">₹${totalPending.toLocaleString('en-IN')}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
                <div class="footer">${isTa ? 'உருவாக்கப்பட்ட நேரம்' : 'Generated on'} ${new Date().toLocaleString(isTa ? 'ta-IN' : 'en-IN')}</div>
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
                background: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '780px',
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

                {/* Filter Tabs & Print Options */}
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Print All Button */}
                        <button
                            onClick={() => handlePrint(null, false)}
                            style={{
                                padding: '6px 12px', borderRadius: '8px', background: '#ffffff',
                                border: '1.5px solid #cbd5e1', color: '#334155', fontSize: '12px',
                                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
                            }}
                            title={lang === 'ta' ? 'அனைத்து பதிவுகளையும் அச்சிடு' : 'Print All Reminders'}
                        >
                            <Printer size={14} color="#16a34a" /> {lang === 'ta' ? 'அனைத்தையும் அச்சிடு' : 'Print All'}
                        </button>

                        {/* Print Selective Button */}
                        <button
                            onClick={() => handlePrint(null, true)}
                            disabled={selectedCount === 0}
                            style={{
                                padding: '6px 12px', borderRadius: '8px',
                                background: selectedCount > 0 ? '#16a34a' : '#f1f5f9',
                                border: '1.5px solid', borderColor: selectedCount > 0 ? '#16a34a' : '#e2e8f0',
                                color: selectedCount > 0 ? '#ffffff' : '#94a3b8', fontSize: '12px',
                                fontWeight: 700, cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
                                display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s'
                            }}
                            title={lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்டவற்றை அச்சிடு' : 'Print Selected Reminders'}
                        >
                            <Printer size={14} color={selectedCount > 0 ? '#ffffff' : '#94a3b8'} /> 
                            {lang === 'ta' 
                                ? `தேர்ந்தெடுக்கப்பட்டவை ${selectedCount > 0 ? `(${selectedCount})` : ''}` 
                                : `Print Selected ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
                        </button>

                        {/* Export Excel Button */}
                        <button
                            onClick={() => handleExportExcel(selectedCount > 0)}
                            style={{
                                padding: '6px 12px', borderRadius: '8px', background: '#f0fdf4',
                                border: '1.5px solid #86efac', color: '#15803d', fontSize: '12px',
                                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
                            }}
                        >
                            <FileSpreadsheet size={14} color="#16a34a" /> {lang === 'ta' ? 'எக்செல் ஏற்றுமதி' : 'Export Excel'}
                        </button>

                        {/* Send All WhatsApp Button */}
                        <button
                            onClick={() => startBatchSendWhatsApp(false)}
                            style={{
                                padding: '6px 12px', borderRadius: '8px', background: '#25D366',
                                border: '1.5px solid #25D366', color: '#ffffff', fontSize: '12px',
                                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)'
                            }}
                            title={lang === 'ta' ? 'அனைத்து வாடிக்கையாளர்களுக்கும் வாட்ஸ்அப் அனுப்பு' : 'Send WhatsApp to All Customers'}
                        >
                            <MessageCircle size={14} /> {lang === 'ta' ? 'அனைவருக்கும் வாட்ஸ்அப்' : 'Send All WhatsApp'}
                        </button>

                        {/* Send Selected WhatsApp Button */}
                        <button
                            onClick={() => startBatchSendWhatsApp(true)}
                            disabled={selectedCount === 0}
                            style={{
                                padding: '6px 12px', borderRadius: '8px',
                                background: selectedCount > 0 ? '#15803d' : '#f1f5f9',
                                border: '1.5px solid', borderColor: selectedCount > 0 ? '#15803d' : '#e2e8f0',
                                color: selectedCount > 0 ? '#ffffff' : '#94a3b8', fontSize: '12px',
                                fontWeight: 700, cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
                                display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s'
                            }}
                            title={lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்டவர்களுக்கு வாட்ஸ்அப் அனுப்பு' : 'Send WhatsApp to Selected Customers'}
                        >
                            <MessageCircle size={14} /> 
                            {lang === 'ta' 
                                ? `தேர்ந்தெடுக்கப்பட்டவருக்கு வாட்ஸ்அப் ${selectedCount > 0 ? `(${selectedCount})` : ''}` 
                                : `Send Selected WhatsApp ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
                        </button>
                    </div>
                </div>

                {/* Search Bar & Select All Toggle */}
                <div style={{ padding: '10px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
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

                    {searchedReminders.length > 0 && (
                        <div 
                            onClick={handleSelectAll}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                padding: '6px 10px', borderRadius: '8px', background: '#f8fafc',
                                border: '1px solid #e2e8f0', userSelect: 'none', whiteSpace: 'nowrap'
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={handleSelectAll}
                                style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#16a34a' }}
                            />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                                {isAllSelected 
                                    ? (lang === 'ta' ? 'தேர்வை நீக்கு' : 'Deselect All') 
                                    : (lang === 'ta' ? 'அனைத்தும் தேர்ந்தெடு' : 'Select All')}
                            </span>
                        </div>
                    )}
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
                            const isSelected = selectedIds.has(rem.id);

                            return (
                                <div
                                    key={rem.id}
                                    style={{
                                        background: isSelected ? '#f0fdf4' : '#ffffff', borderRadius: '16px', border: '1.5px solid',
                                        borderColor: isSelected ? '#16a34a' : rem.status === 'Completed' ? '#e2e8f0' : isOverdue ? '#fca5a5' : isToday ? '#fde047' : '#cbd5e1',
                                        padding: '16px', boxShadow: isSelected ? '0 4px 12px rgba(22, 163, 74, 0.1)' : '0 2px 8px rgba(0,0,0,0.03)',
                                        display: 'flex', flexDirection: 'column', gap: '12px', transition: 'all 0.15s'
                                    }}
                                >
                                    {/* Item Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {/* Checkbox for selective print */}
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(rem.id)}
                                                style={{
                                                    width: '18px', height: '18px', cursor: 'pointer',
                                                    accentColor: '#16a34a', flexShrink: 0
                                                }}
                                            />
                                            <div style={{
                                                width: '38px', height: '38px', borderRadius: '50%', background: '#f1f5f9',
                                                border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, color: '#475569'
                                            }}>
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                                                    {getBuyerDisplayName(rem)}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                                                    {lang === 'ta' ? 'கடைசி விற்பனை தேதி' : 'Latest Sales Date'}: <span style={{ fontWeight: 700, color: '#334155' }}>{formatDateDDMMYYYY(rem.salesDate)}</span>
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
                                                {lang === 'ta' 
                                                    ? (rem.status === 'Completed' ? 'முடிவடைந்தது' : rem.status === 'Remind Later' ? 'பின்னர் நினைவூட்டு' : 'நிலுவையில் உள்ளது')
                                                    : rem.status}
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

                                        {/* Card Individual Print Button */}
                                        <button
                                            onClick={() => handlePrint([rem], false)}
                                            style={{
                                                padding: '9px 12px', borderRadius: '10px', background: '#ffffff',
                                                border: '1.5px solid #cbd5e1', color: '#334155', fontSize: '12px',
                                                fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
                                            }}
                                            title={lang === 'ta' ? 'அச்சிடு' : 'Print Slip'}
                                        >
                                            <Printer size={14} color="#16a34a" /> {lang === 'ta' ? 'அச்சிடு' : 'Print'}
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
                                                <CheckCircle size={14} /> {lang === 'ta' ? 'நினைவூட்டல் முடிவடைந்தது' : 'Reminder Completed'}
                                            </div>
                                            <button
                                                onClick={() => handleViewCustomer(rem.buyerId)}
                                                style={{
                                                    padding: '4px 8px', borderRadius: '6px', background: '#f8fafc',
                                                    border: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px',
                                                    fontWeight: 700, cursor: 'pointer'
                                                }}
                                            >
                                                {lang === 'ta' ? 'வாடிக்கையாளரைப் பார்' : 'View Customer'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Batch WhatsApp Sender Modal */}
            {isBatchSenderOpen && batchQueue.length > 0 && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
                }}>
                    <div style={{
                        background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '480px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', border: '1.5px solid #86efac',
                        padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
                        animation: 'in 0.2s ease-out'
                    }}>
                        {/* Batch Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MessageCircle size={20} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                                        {lang === 'ta' ? 'வாட்ஸ்அப் தொகுதி நினைவூட்டல்' : 'Batch WhatsApp Sender'}
                                    </h3>
                                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0, fontWeight: 600 }}>
                                        {lang === 'ta' ? `வரிசை ${batchIndex + 1} / ${batchQueue.length}` : `Sending ${batchIndex + 1} of ${batchQueue.length}`}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsBatchSenderOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '100px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', background: '#25D366', borderRadius: '100px',
                                width: `${((batchIndex + 1) / batchQueue.length) * 100}%`,
                                transition: 'width 0.3s ease'
                            }} />
                        </div>

                        {/* Current Customer Card */}
                        {batchQueue[batchIndex] && (() => {
                            const currentRem = batchQueue[batchIndex];
                            const currentBuyer = buyers.find(b => b.id === currentRem.buyerId || (b.name && b.name.toLowerCase() === (currentRem.buyerName || '').toLowerCase()));
                            const currentContact = currentBuyer?.contact || currentRem.contact || '';
                            const currentName = getBuyerDisplayName(currentRem);

                            return (
                                <div style={{ background: '#f0fdf4', borderRadius: '14px', border: '1.5px solid #86efac', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{currentName}</div>
                                            <div style={{ fontSize: '13px', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>📞 +91 {currentContact}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '18px', fontWeight: 900, color: '#dc2626' }}>{fmt(currentRem.pendingAmount)}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{formatDateDDMMYYYY(currentRem.salesDate)}</div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                        <button
                                            onClick={async () => {
                                                await handleSendWhatsApp(currentRem);
                                                if (batchIndex + 1 < batchQueue.length) {
                                                    setBatchIndex(prev => prev + 1);
                                                } else {
                                                    setIsBatchSenderOpen(false);
                                                    alert(lang === 'ta' ? 'அனைத்து வாட்ஸ்அப் நினைவூட்டல்களும் அனுப்பப்பட்டன!' : 'All batch WhatsApp reminders opened successfully!');
                                                }
                                            }}
                                            style={{
                                                width: '100%', padding: '11px', borderRadius: '10px', background: '#25D366',
                                                color: '#ffffff', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                                                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                                            }}
                                        >
                                            <MessageCircle size={16} />
                                            {lang === 'ta' ? `வாட்ஸ்அப் அனுப்பு (${currentName})` : `Send WhatsApp to ${currentName}`}
                                        </button>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {batchIndex + 1 < batchQueue.length && (
                                                <button
                                                    onClick={() => setBatchIndex(prev => prev + 1)}
                                                    style={{
                                                        flex: 1, padding: '9px', borderRadius: '8px', background: '#ffffff',
                                                        border: '1.5px solid #cbd5e1', color: '#475569', fontSize: '12px',
                                                        fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                                    }}
                                                >
                                                    <ChevronRight size={14} /> {lang === 'ta' ? 'தவிர் / அடுத்தவர்' : 'Skip Customer'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setIsBatchSenderOpen(false)}
                                                style={{
                                                    flex: 1, padding: '9px', borderRadius: '8px', background: '#ffffff',
                                                    border: '1.5px solid #fca5a5', color: '#ef4444', fontSize: '12px',
                                                    fontWeight: 700, cursor: 'pointer'
                                                }}
                                            >
                                                {lang === 'ta' ? 'நிறுத்து' : 'Cancel Batch'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentRemindersModal;
