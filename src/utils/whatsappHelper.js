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
