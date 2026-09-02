/**
 * Helper to format phone number and open WhatsApp directly with the customer/vendor
 */
export const formatWhatsAppPhone = (contact) => {
    if (!contact) return '';
    const clean = String(contact).replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length === 10) return `91${clean}`;
    if (clean.length === 12 && clean.startsWith('91')) return clean;
    return clean;
};

export const openWhatsAppDirect = async ({ phone, text = '', blob = null, fileName = 'bill.png' }) => {
    const formattedPhone = formatWhatsAppPhone(phone);
    const encodedText = encodeURIComponent(text);

    // If phone number is present, target direct WhatsApp chat using api.whatsapp.com / wa.me
    const waUrl = formattedPhone 
        ? `https://api.whatsapp.com/send?phone=${formattedPhone}${text ? `&text=${encodedText}` : ''}`
        : `https://api.whatsapp.com/send?text=${encodedText}`;

    // Handle File if image blob is provided
    if (blob) {
        const file = new File([blob], fileName, { type: 'image/png' });
        const url = URL.createObjectURL(blob);

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: fileName,
                    text: text || ''
                });
            } catch (e) {
                console.log('Native share dismissed:', e);
            }
        } else {
            // Trigger automatic download of image file
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
    }

    // Always open WhatsApp directly to the customer's chat window
    setTimeout(() => {
        window.open(waUrl, '_blank');
    }, blob ? 400 : 0);
};

/**
 * Formats date string (YYYY-MM-DD or ISO/timestamp) to DD/MM/YYYY DDMMYYYY format
 */
export const formatDateDDMMYYYY = (dateVal, separator = '/') => {
    if (!dateVal) return '—';
    try {
        let str = '';
        if (typeof dateVal === 'string') {
            str = dateVal.trim();
        } else if (dateVal.toDate && typeof dateVal.toDate === 'function') {
            str = dateVal.toDate().toISOString();
        } else if (dateVal instanceof Date) {
            str = dateVal.toISOString();
        } else {
            str = String(dateVal);
        }

        if (str.includes('T')) {
            str = str.split('T')[0];
        }

        if (str.includes('-')) {
            const parts = str.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    const [y, m, d] = parts;
                    return `${d.padStart(2, '0')}${separator}${m.padStart(2, '0')}${separator}${y}`;
                }
                if (parts[2].length === 4) {
                    const [d, m, y] = parts;
                    return `${d.padStart(2, '0')}${separator}${m.padStart(2, '0')}${separator}${y}`;
                }
            }
        }

        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    const [y, m, d] = parts;
                    return `${d.padStart(2, '0')}${separator}${m.padStart(2, '0')}${separator}${y}`;
                }
                if (parts[2].length === 4) {
                    const [d, m, y] = parts;
                    return `${d.padStart(2, '0')}${separator}${m.padStart(2, '0')}${separator}${y}`;
                }
            }
        }

        return str;
    } catch (e) {
        return String(dateVal || '—');
    }
};

