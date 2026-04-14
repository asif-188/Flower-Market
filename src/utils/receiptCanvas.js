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
    labels        = {}, // Translation labels
}) {
    const {
        date = 'தேதி',
        nameLabel = 'பெயர்',
        oldBalance = 'முன் பாக்கி',
        cashRec = 'வரவு',
        cashLess: cashLessLabel = 'கழி',
        balance = 'பாக்கி',
        particulars = 'விபரம்',
        weight = 'எடை',
        rate = 'விலை',
        total = 'தொகை',
        grandTotalLabel = 'மொத்த பாக்கி',
    } = labels;

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
    drawText(`${date} : ${dateLabel}`, W - PAD - 10, y + 22, { size: 22, weight: '800', align: 'right' });
    y += 45;

    // 4. Customer & Balance Box
    const infoH = 160; // Increased for 4 rows
    rect(PAD, y, W - PAD*2, infoH);
    // Left: Code / Name
    drawText(`CODE : ${buyer.displayId || '---'}`, PAD + 10, y + 60, { size: 22, weight: '700' });
    const bName = buyer.taName || buyer.nameTa || buyer.name || '---';
    drawText(`${nameLabel} : ${bName.toUpperCase()}`, PAD + 10, y + 105, { size: 22, weight: '700' });
    
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
    drawBalRow(y,       oldBalance, prevBalance);
    drawBalRow(y + 40,  cashRec,          paymentsTotal);
    drawBalRow(y + 80,  cashLessLabel,           cashLess);
    drawBalRow(y + 120, balance,        (prevBalance - paymentsTotal - cashLess), true);
    y += infoH;

    // 5. Items Table
    const colW = [300, 110, 130, 160];
    const cols = [PAD, PAD + colW[0], PAD + colW[0] + colW[1], PAD + colW[0] + colW[1] + colW[2]];
    
    // Header
    rect(PAD, y, W - PAD*2, 45);
    const headerLabels = [particulars, weight, rate, total];
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
            const fName = item.flowerTypeTa || item.flowerType || '';
            drawText(fName, cols[0] + 10, rowY, { size: 22, weight: '600' });
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
    drawText(grandTotalLabel, PAD + 20, y + 30, { size: 28, weight: '900' });
    drawText(fmtNum(absGrandTotal, 2), W - PAD - 20, y + 30, { size: 32, weight: '900', align: 'right' });
    y += 100;

    drawText('🌹 நன்றி (Thank You) 🌹', W/2, y, { size: 28, align: 'center' });

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({ blob, url: URL.createObjectURL(blob) });
        }, 'image/png');
    });
}

/**
 * generateLedgerCanvas
 * Draws a detailed "Statement" style ledger matching the printout:
 * Columns: DATE | PARTICULARS | WEIGHT | RATE | TOTAL | CASH REC | CASH LESS
 */
export async function generateLedgerCanvas({
    buyer,
    ledgerRows     = [], // { date, particulars, weight, rate, total, cashRec, cashLess }
    summary        = {}, // { sales, paid, less }
    openingBalance = 0,
    bizInfo        = {},
    labels         = {},
}) {
    const {
        date        = 'DATE',
        particulars = 'PARTICULARS',
        weight      = 'WEIGHT',
        rate        = 'RATE',
        total       = 'TOTAL',
        cashRec     = 'CASH REC',
        cashLess    = 'CASH LESS',
        openingBalLabel = 'Opening Balance',
        statementTitle  = 'STATEMENT',
        customerNoLabel = 'Customer No',
        nameLabel       = 'Name',
        totalSalesLabel = 'Total Sales :',
        cashRecLabel    = 'Cash Rec :',
        cashLessLabel   = 'Cash Less :',
        finalBalLabel   = 'Final Balance :',
        thankYou   = '🌹 Thank you! 🌹',
    } = labels;

    const W      = 800;
    const PAD    = 40;
    const LINE_H = 35;
    
    const {
        name    = 'S.V.M',
        type    = 'Sri Valli Flower Merchant',
        address = 'B-7, Flower Market, Tindivanam.',
        phone1  = '9952535057',
        phone2  = '9443247771',
    } = bizInfo;

    const fmtNum = (n, dec = 0) =>
        new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

    const H = 850 + (Math.max(ledgerRows.length, 10) * LINE_H);
    const canvas  = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx     = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const drawText = (str, x, y, { size = 20, weight = 'normal', align = 'left', color = '#000' } = {}) => {
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

    let y = 30;

    // Header
    drawText(name, W/2, y, { size: 42, weight: '900', align: 'center' });
    y += 40;
    drawText(type, W/2, y, { size: 22, weight: '700', align: 'center' });
    y += 25;
    drawText(address, W/2, y, { size: 18, align: 'center' });
    y += 30;

    // Phones
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    y += 18;
    drawText(`CELL : ${phone1}`, PAD + 10, y, { size: 18, weight: '700' });
    drawText(`CELL : ${phone2}`, W - PAD - 10, y, { size: 18, weight: '700', align: 'right' });
    y += 22;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    y += 40;

    // Title
    drawText(statementTitle, W/2, y, { size: 26, weight: '900', align: 'center' });
    y += 40;

    // Customer Info
    drawText(`${customerNoLabel} : ${buyer.displayId || '---'}`, PAD + 10, y, { size: 20, weight: '700' });
    y += 25;
    const bNameLedger = buyer.taName || buyer.nameTa || buyer.name || '---';
    drawText(`${nameLabel} : ${bNameLedger}`, PAD + 10, y, { size: 20, weight: '700' });
    y += 30;
    
    // Double Border before table
    ctx.beginPath(); ctx.lineWidth = 1; ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    y += 3;
    ctx.beginPath(); ctx.lineWidth = 1; ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    y += 2;

    // Table Setup
    const colStarts = [PAD, PAD+75, PAD+265, PAD+345, PAD+425, PAD+515, PAD+615];
    const colWidths = [75, 190, 80, 80, 90, 100, 85];
    const colHeaders = [date, particulars, weight, rate, total, cashRec, cashLess];

    // Header Row
    rect(PAD, y, W - PAD*2, 40);
    colHeaders.forEach((lab, i) => {
        const x = colStarts[i] + colWidths[i]/2;
        drawText(lab, x, y + 20, { size: 16, weight: '800', align: 'center' });
        if (i > 0) { ctx.beginPath(); ctx.moveTo(colStarts[i], y); ctx.lineTo(colStarts[i], y + 40); ctx.stroke(); }
    });
    y += 40;

    const tableStartY = y;

    // Opening Balance Row
    const drawRow = (rowY, data, isOpening = false) => {
        const { date, particulars, weight, rate, total, cashRec, cashLess } = data;
        const vals = [date, particulars, weight, rate, total, cashRec, cashLess];
        vals.forEach((v, i) => {
            let x = colStarts[i] + 10;
            let align = 'left';
            if (i >= 2) { x = colStarts[i] + colWidths[i] - 10; align = 'right'; }
            if (i === 1) { x = colStarts[i] + 10; }
            if (i === 0 || i === 2 || i === 3) { x = colStarts[i] + colWidths[i]/2; align = 'center'; }

            drawText(String(v || (i >= 2 && !isOpening ? '0' : '')), x, rowY + LINE_H/2, { size: 16, align, weight: isOpening ? '700' : 'normal' });
            if (i > 0) { ctx.beginPath(); ctx.moveTo(colStarts[i], rowY); ctx.lineTo(colStarts[i], rowY + LINE_H); ctx.stroke(); }
        });
        ctx.beginPath(); ctx.moveTo(PAD, rowY + LINE_H); ctx.lineTo(W - PAD, rowY + LINE_H); ctx.stroke();
    };

    drawRow(y, { date: 'Opening', particulars: openingBalLabel, weight: '0.000', rate: '0', total: fmtNum(openingBalance), cashRec: '0', cashLess: '0' }, true);
    y += LINE_H;

    // Data Rows
    ledgerRows.forEach(row => {
        drawRow(y, row);
        y += LINE_H;
    });

    // Fill remaining space if few rows
    const minRows = 10;
    if (ledgerRows.length < minRows) {
        for (let i = ledgerRows.length; i < minRows; i++) {
            // Empty grid lines
            colStarts.forEach((x, j) => {
                if (j > 0) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + LINE_H); ctx.stroke(); }
            });
            ctx.beginPath(); ctx.moveTo(PAD, y + LINE_H); ctx.lineTo(W - PAD, y + LINE_H); ctx.stroke();
            y += LINE_H;
        }
    }

    // Outer Table Borders
    rect(PAD, tableStartY, W - PAD*2, y - tableStartY);

    y += 30;

    // Summary Box
    const sumW = W - PAD*2;
    rect(PAD, y, sumW, 110);
    const drawSumRow = (sy, label, val) => {
        drawText(label, PAD + 15, sy + 18, { size: 18, weight: '700' });
        drawText(fmtNum(val), W - PAD - 15, sy + 18, { size: 18, weight: '800', align: 'right' });
    };
    drawSumRow(y,      totalSalesLabel, summary.sales);
    drawSumRow(y + 35, cashRecLabel,    summary.paid);
    drawSumRow(y + 70, cashLessLabel,   summary.less);
    
    // Final Balance Row (with different styling to stand out)
    const finalBal = openingBalance + summary.sales - summary.paid - summary.less;
    y += 105;
    ctx.beginPath(); ctx.moveTo(PAD + 10, y); ctx.lineTo(W - PAD - 10, y); ctx.stroke();
    drawText(finalBalLabel, PAD + 15, y + 18, { size: 20, weight: '800' });
    drawText(fmtNum(finalBal), W - PAD - 15, y + 18, { size: 20, weight: '900', align: 'right' });
    
    // Explicit Formula Line
    y += 40;
    const formulaText = `[ ${openingBalLabel.replace(':','')} + ${totalSalesLabel.replace(':','')} - ${cashRecLabel.replace(':','')} - ${cashLessLabel.replace(':','')} ]`;
    drawText(formulaText, W/2, y, { size: 14, align: 'center', color: '#64748b', weight: '600' });
    
    y += 40;

    // Footer
    drawText(thankYou, W/2, y, { size: 24, align: 'center' });

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({ blob, url: URL.createObjectURL(blob) });
        }, 'image/png');
    });
}
