/**
 * generateBuyerReceiptCanvas
 * Draws a Tamil-style flower-market receipt matching the letterhead layout:
 *   - Motto line at top-center
 *   - Left phone | Motto | Right phone (top row)
 *   - Large bold shop name (center)
 *   - Shop type / address (center)
 *   - Customer, date, items, summary
 *
 * bizInfo fields expected:
 *   motto   — e.g. "SRI RAMA JAYAM"
 *   name    — e.g. "S.V.M"
 *   type    — e.g. "SRI VALLI FLOWER MERCHANT"
 *   address — e.g. "B-7, FLOWER MARKET, TINDIVANAM."
 *   phone1  — e.g. "9952535057"
 *   phone2  — e.g. "9443247771"
 */
export async function generateBuyerReceiptCanvas({
    buyer,
    salesItems    = [],
    salesTotal    = 0,
    paymentsTotal = 0,
    cashLess      = 0,
    prevBalance   = 0,
    dateLabel     = '',
    bizInfo       = {},
}) {
    const W       = 800;
    const PAD     = 50;
    const LINE_H  = 40;
    
    const {
        motto   = 'SRI RAMA JAYAM',
        name    = 'S.V.M',
        type    = 'SRI VALLI FLOWER MERCHANT',
        address = 'B-7, FLOWER MARKET, TINDIVANAM.',
        phone1  = '9443247771',
        phone2  = '9952535057',
    } = bizInfo;

    const fmtNum = (n, dec = 0) =>
        new Intl.NumberFormat('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n || 0);

    const displayDate = (iso) => {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    };

    const runningBalance = prevBalance - paymentsTotal - cashLess;
    const absGrandTotal  = runningBalance + salesTotal;

    // ── Calculate Height ──
    const rowsCount = Math.max(salesItems.length, 12);
    const H = 1000 + (rowsCount * LINE_H); // Increased for extra info row

    const canvas  = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx     = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const drawText = (str, x, y, { size = 22, weight = 'normal', align = 'left', color = '#000' } = {}) => {
        ctx.font         = `${weight} ${size}px serif`;
        ctx.fillStyle    = color;
        ctx.textAlign    = align;
        ctx.textBaseline = 'middle';
        ctx.fillText(str || '', x, y);
    };

    const rect = (x, y, w, h) => {
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(x, y, w, h);
    };

    let y = PAD;

    // 1. Mottos
    drawText(motto, W/2, y, { size: 24, weight: '600', align: 'center' });
    y += 30;
    drawText('SRI PERIYANDAVAR THUNAI', W/2, y, { size: 24, weight: '600', align: 'center' });
    y += 40;

    // 2. Shop Info Box
    const boxY = y;
    rect(PAD, boxY, W - PAD*2, 160);
    drawText(name, W/2, boxY + 50, { size: 52, weight: '900', align: 'center' });
    drawText(type, W/2, boxY + 95, { size: 24, weight: '700', align: 'center' });
    drawText(address, W/2, boxY + 125, { size: 20, align: 'center' });
    
    // Phones at bottom of box
    ctx.beginPath();
    ctx.moveTo(PAD, boxY + 135); ctx.lineTo(W - PAD, boxY + 135); ctx.stroke();
    drawText(`CELL : ${phone1}`, PAD + 10, boxY + 152, { size: 20, weight: '700' });
    drawText(`CELL : ${phone2}`, W - PAD - 10, boxY + 152, { size: 20, weight: '700', align: 'right' });
    y += 160;

    // 3. Sales | Date Row
    rect(PAD, y, W - PAD*2, 45);
    drawText('SALES', PAD + 10, y + 22, { size: 22, weight: '800' });
    drawText(`தேதி : ${dateLabel}`, W - PAD - 10, y + 22, { size: 22, weight: '800', align: 'right' });
    y += 45;

    // 4. Customer & Balance Box
    const infoH = 160; // Increased for 4 rows
    rect(PAD, y, W - PAD*2, infoH);
    // Left: Code / Name
    drawText(`CODE : ${buyer.displayId || '---'}`, PAD + 10, y + 60, { size: 22, weight: '700' });
    drawText(`பெயர் : ${buyer.name?.toUpperCase() || '---'}`, PAD + 10, y + 105, { size: 22, weight: '700' });
    
    // Right: Balance Grid (4 Rows)
    const balW = 280;
    const balX = W - PAD - balW;
    const labelW = 160; // Internal split
    
    // Outer Border Line
    ctx.beginPath(); ctx.moveTo(balX, y); ctx.lineTo(balX, y + infoH); ctx.stroke();
    // Inner Vertical Line
    ctx.beginPath(); ctx.moveTo(balX + labelW, y); ctx.lineTo(balX + labelW, y + infoH); ctx.stroke();
    
    const drawBalRow = (ly, label, value, isLast = false) => {
        drawText(label, balX + 10, ly + 20, { size: 18, align: 'left' });
        drawText(fmtNum(value), W - PAD - 10, ly + 20, { size: 20, weight: '800', align: 'right' });
        if (!isLast) { ctx.beginPath(); ctx.moveTo(balX, ly + 40); ctx.lineTo(W - PAD, ly + 40); ctx.stroke(); }
    };
    drawBalRow(y,       'முன் பாக்கி', prevBalance);
    drawBalRow(y + 40,  'வரவு',          paymentsTotal);
    drawBalRow(y + 80,  'கழி',           cashLess);
    drawBalRow(y + 120, 'பாக்கி',        (prevBalance - paymentsTotal - cashLess), true);
    y += infoH;

    // 5. Items Table
    const colW = [300, 110, 130, 160];
    const cols = [PAD, PAD + colW[0], PAD + colW[0] + colW[1], PAD + colW[0] + colW[1] + colW[2]];
    
    // Header
    rect(PAD, y, W - PAD*2, 45);
    const headerLabels = ['விபரம்', 'எடை', 'விலை', 'தொகை'];
    headerLabels.forEach((lab, i) => {
        let textX = cols[i];
        let align = 'center';
        
        if (i === 0) { textX = cols[i] + 10; align = 'left'; }
        else if (i === 1) { textX = cols[i] + colW[1]/2; }
        else if (i === 2) { textX = cols[i] + colW[2]/2; }
        else if (i === 3) { textX = W - PAD - 10; align = 'right'; }
        
        drawText(lab, textX, y + 22, { size: 20, weight: '800', align });
        if (i > 0) { ctx.beginPath(); ctx.moveTo(cols[i], y); ctx.lineTo(cols[i], y + 45); ctx.stroke(); }
    });
    y += 45;

    // Data Rows
    const tableStartY = y;
    for (let i = 0; i < rowsCount; i++) {
        const item = salesItems[i];
        const rowY = y + 20;
        if (item) {
            drawText(item.flowerType, cols[0] + 10, rowY, { size: 22, weight: '600' });
            drawText(parseFloat(item.quantity).toFixed(3), cols[1] + colW[1]/2, rowY, { size: 20, align: 'center' });
            drawText(fmtNum(item.price), cols[2] + colW[2]/2, rowY, { size: 20, align: 'center' });
            drawText(fmtNum(item.total), W - PAD - 10, rowY, { size: 22, weight: '800', align: 'right' });
        }
        y += LINE_H;
        
        // Horizontal line for each flower row
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.moveTo(PAD, y);
        ctx.lineTo(W - PAD, y);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5; // Thin line for rows
        ctx.stroke();
    }

    // Main vertical grid lines (Restore full borders)
    ctx.lineWidth = 1.5;
    [1, 2, 3].forEach(i => {
        ctx.beginPath(); ctx.moveTo(cols[i], tableStartY); ctx.lineTo(cols[i], y); ctx.stroke();
    });
    rect(PAD, tableStartY, W - PAD*2, y - tableStartY);

    // 6. Grand Total
    rect(PAD, y, W - PAD*2, 60);
    drawText('மொத்த பாக்கி', PAD + 20, y + 30, { size: 28, weight: '900' });
    drawText(fmtNum(absGrandTotal, 2), W - PAD - 20, y + 30, { size: 32, weight: '900', align: 'right' });
    y += 100;

    drawText('🌹 நன்றி (Thank You) 🌹', W/2, y, { size: 28, align: 'center' });

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({ blob, url: URL.createObjectURL(blob) });
        }, 'image/png');
    });
}
