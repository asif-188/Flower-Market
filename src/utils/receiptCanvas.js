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
    lang          = 'en',
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
        sNo = 'வ.எண்',
        salesLabel = 'SALES',
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
        return `${d}-${m}-${y}`;
    };

    const runningBalance = prevBalance - paymentsTotal - cashLess;
    const absGrandTotal  = runningBalance + salesTotal;

    // ── Calculate Height ──
    const rowsCount = salesItems.length;
    const H = 850 + (rowsCount * LINE_H); // Reduced base height since we don't force empty rows

    const canvas  = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx     = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const drawText = (str, x, y, { size = 22, weight = 'normal', align = 'left', color = '#000', maxWidth, wrapWidth, lineHeight = 32 } = {}) => {
        ctx.font         = `${weight} ${size}px sans-serif`;
        ctx.fillStyle    = color;
        ctx.textAlign    = align;
        ctx.textBaseline = 'middle';
        if (wrapWidth) {
            const words = (str || '').split(' ');
            let line = '';
            let currentY = y;
            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                const testWidth = ctx.measureText(testLine).width;
                if (testWidth > wrapWidth && i > 0) {
                    ctx.fillText(line.trim(), x, currentY, wrapWidth);
                    line = words[i] + ' ';
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line.trim(), x, currentY, wrapWidth);
        } else if (maxWidth) {
            ctx.fillText(str || '', x, y, maxWidth);
        } else {
            ctx.fillText(str || '', x, y);
        }
    };

    const rect = (x, y, w, h) => {
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(x, y, w, h);
    };

    let y = PAD;

    // 1. Mottos
    if (motto) {
        drawText(motto, W/2, y, { size: 22, weight: '700', align: 'center' });
        y += 40;
    }

    // 2. Shop Info Box
    const boxY = y;
    rect(PAD, boxY, W - PAD*2, 200);
    // Use serif for the name to match the sign board image
    ctx.font = '900 86px serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, W/2, boxY + 65);
    
    drawText(type, W/2, boxY + 115, { size: 28, weight: '700', align: 'center' });
    drawText(address, W/2, boxY + 145, { size: 22, align: 'center' });
    
    // Phones at bottom of box - centered
    drawText(`CELL : ${phone1}           CELL : ${phone2}`, W/2, boxY + 175, { size: 22, weight: '700', align: 'center' });
    y += 200;

    // 3. Sales | Date Row
    rect(PAD, y, W - PAD*2, 45);
    drawText(salesLabel, PAD + 10, y + 22, { size: 22, weight: '800' });
    drawText(`${date} : ${dateLabel}`, W - PAD - 10, y + 22, { size: 22, weight: '800', align: 'right' });
    y += 45;

    // 4. Customer & Balance Box
    const infoH = 160; // Increased for 4 rows
    rect(PAD, y, W - PAD*2, infoH);
    // Left: Code / Name
    drawText(`CODE : ${buyer.displayId || '---'}`, PAD + 15, y + 45, { size: 26, weight: '800' });
    drawText(`${nameLabel} : ${(buyer.name || '---').toUpperCase()}`, PAD + 15, y + 95, { size: 26, weight: '800', wrapWidth: 390, lineHeight: 32 });
    
    // Right: Balance Grid (4 Rows)
    const balW = 280;
    const balX = W - PAD - balW;
    const labelW = 160; // Internal split
    
    // Outer Border Line
    ctx.beginPath(); ctx.moveTo(balX, y); ctx.lineTo(balX, y + infoH); ctx.stroke();
    // Inner Vertical Line
    ctx.beginPath(); ctx.moveTo(balX + labelW, y); ctx.lineTo(balX + labelW, y + infoH); ctx.stroke();
    
    const drawBalRow = (ly, label, value, isLast = false, valueColor = '#000') => {
        drawText(label, balX + 10, ly + 20, { size: 18, align: 'left' });
        drawText(fmtNum(value), W - PAD - 10, ly + 20, { size: 20, weight: '800', align: 'right', color: valueColor });
        if (!isLast) { ctx.beginPath(); ctx.moveTo(balX, ly + 40); ctx.lineTo(W - PAD, ly + 40); ctx.stroke(); }
    };
    drawBalRow(y,       oldBalance, prevBalance);
    drawBalRow(y + 40,  cashRec,          paymentsTotal, false, '#15803d');
    drawBalRow(y + 80,  cashLessLabel,           cashLess, false, '#b91c1c');
    drawBalRow(y + 120, balance,        (prevBalance - paymentsTotal - cashLess), true);
    y += infoH;

    // 5. Items Table
    const colW = [85, 235, 100, 120, 160];
    const cols = [PAD, PAD + colW[0], PAD + colW[0] + colW[1], PAD + colW[0] + colW[1] + colW[2], PAD + colW[0] + colW[1] + colW[2] + colW[3]];
    
    // Header
    rect(PAD, y, W - PAD*2, 45);
    const headerLabels = [sNo, particulars, weight, rate, total];
    headerLabels.forEach((lab, i) => {
        let textX = cols[i];
        let align = 'center';
        
        if (i === 1) { textX = cols[i] + 10; align = 'left'; }
        else if (i === 0) { textX = cols[0] + colW[0]/2; }
        else if (i === 2) { textX = cols[2] + colW[2]/2; }
        else if (i === 3) { textX = cols[3] + colW[3]/2; }
        else if (i === 4) { textX = W - PAD - 10; align = 'right'; }
        
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
            const fName = lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType;
            drawText(String(i + 1), cols[0] + colW[0]/2, rowY, { size: 20, align: 'center' });
            drawText(fName || '', cols[1] + 10, rowY, { size: 22, weight: '600' });
            drawText(parseFloat(item.quantity).toFixed(3), cols[2] + colW[2]/2, rowY, { size: 20, align: 'center' });
            drawText(fmtNum(item.price), cols[3] + colW[3]/2, rowY, { size: 20, align: 'center' });
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

    // Draw vertical grid lines for the full table height
    ctx.lineWidth = 1.0;
    ctx.setLineDash([]);
    ctx.strokeStyle = '#000';
    [cols[1], cols[2], cols[3], cols[4]].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, tableStartY - 45); // Start from header top
        ctx.lineTo(x, y);
        ctx.stroke();
    });

    // Outer border for the entire data area
    rect(PAD, tableStartY, W - PAD*2, y - tableStartY);

    // 5b. Total Sales
    ctx.lineWidth = 1.5;
    rect(PAD, y, W - PAD*2, 50);
    drawText(labels.totalSalesLabel || 'Total Sales', PAD + 20, y + 25, { size: 24, weight: '800' });
    drawText(fmtNum(salesTotal), W - PAD - 20, y + 25, { size: 28, weight: '800', align: 'right', color: '#b91c1c' });
    y += 70;

    // 6. Grand Total
    ctx.lineWidth = 3.0;
    rect(PAD, y, W - PAD*2, 70);
    drawText(grandTotalLabel, PAD + 20, y + 35, { size: 28, weight: '900' });
    drawText(`₹${fmtNum(absGrandTotal, 2)}`, W - PAD - 20, y + 35, { size: 36, weight: '900', align: 'right' });
    y += 90;
    ctx.lineWidth = 1.5;

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
    lang           = 'en',
    multiPage      = false,
    startDate      = '',
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
        sNoLabel   = 'S.No',
        dateLabel  = '',

    } = labels;

    const W      = 950;
    const PAD    = 50;
    const LINE_H = 48;
    
    const {
        name    = 'S.V.M',
        type    = 'Sri Valli Flower Merchant',
        address = 'B-7, Flower Market, Tindivanam.',
        phone1  = '9952535057',
        phone2  = '9443247771',
    } = bizInfo;

    const fmtNum = (n, dec = 0) =>
        new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

    const colWidths = [135, 220, 85, 75, 105, 115, 115];
    const colStarts = [
        PAD, 
        PAD + colWidths[0], 
        PAD + colWidths[0] + colWidths[1], 
        PAD + colWidths[0] + colWidths[1] + colWidths[2], 
        PAD + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], 
        PAD + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], 
        PAD + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5]
    ];
    const colHeaders = [date, particulars, weight, rate, total, cashRec, cashLess];

    if (multiPage) {
        const PAGE_H = 1344;
        const BOTTOM_MARGIN = 60;
        const LIMIT_H = PAGE_H - BOTTOM_MARGIN; // 1284
        
        // Calculate dynamic tableStartY
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = W;
        const dummyCtx = dummyCanvas.getContext('2d');
        dummyCtx.font = '700 22px sans-serif';
        const nameStr = `${nameLabel} : ${buyer.name || '---'}`;
        const nameWidth = dummyCtx.measureText(nameStr).width;
        const isNameWrapped = nameWidth > (W - PAD*2 - 20);
        const firstPageTableStartY = 30 + 45 + 28 + 32 + 18 + 22 + 40 + 40 + 28 + (isNameWrapped ? 58 : 30) + 3 + 2;

        const displayStartDate = startDate ? startDate.split('-').reverse().join('/') : '';
        const allRows = [
            { date: displayStartDate, particulars: openingBalLabel, weight: '0.000', rate: '0', total: openingBalance, cashRec: 0, cashLess: 0, isOpening: true },
            ...ledgerRows
        ];

        const pagesLayout = [];
        let currentItemIndex = 0;
        const totalItems = allRows.length;

        while (currentItemIndex < totalItems) {
            const isFirstPage = pagesLayout.length === 0;
            const remainingCount = totalItems - currentItemIndex;
            
            const headerH = isFirstPage ? (firstPageTableStartY + 40) : 140;
            const rowsH = remainingCount * LINE_H;
            const footerH = 250; // summary box + footer space
            const totalNeeded = headerH + rowsH + footerH;
            
            if (totalNeeded <= LIMIT_H) {
                // Fits on this page and it is the last page
                pagesLayout.push({
                    isFirst: isFirstPage,
                    isLast: true,
                    startIndex: currentItemIndex,
                    endIndex: totalItems
                });
                break;
            } else {
                // Does not fit on this page, so split it
                const availableH = LIMIT_H - headerH;
                let fitCount = Math.floor(availableH / LINE_H);
                if (fitCount <= 0) fitCount = 1; // safety fallback
                
                pagesLayout.push({
                    isFirst: isFirstPage,
                    isLast: false,
                    startIndex: currentItemIndex,
                    endIndex: currentItemIndex + fitCount
                });
                currentItemIndex += fitCount;
            }
        }

        // Draw each page
        const pagePromises = pagesLayout.map((pLayout, pageIdx) => {
            return new Promise((resolve) => {
                const canvas = document.createElement('canvas');
                canvas.width = W;
                canvas.height = PAGE_H;
                const ctx = canvas.getContext('2d');
                
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, W, PAGE_H);

                const drawText = (str, x, y, { size = 20, weight = 'normal', align = 'left', color = '#000', maxWidth, wrapWidth, lineHeight = 28 } = {}) => {
                    ctx.font         = `${weight} ${size}px sans-serif`;
                    ctx.fillStyle    = color;
                    ctx.textAlign    = align;
                    ctx.textBaseline = 'middle';
                    if (wrapWidth) {
                        const words = (str || '').split(' ');
                        let line = '';
                        let currentY = y;
                        for (let i = 0; i < words.length; i++) {
                            const testLine = line + words[i] + ' ';
                            const testWidth = ctx.measureText(testLine).width;
                            if (testWidth > wrapWidth && i > 0) {
                                ctx.fillText(line.trim(), x, currentY, wrapWidth);
                                line = words[i] + ' ';
                                currentY += lineHeight;
                            } else {
                                line = testLine;
                            }
                        }
                        ctx.fillText(line.trim(), x, currentY, wrapWidth);
                    } else if (maxWidth) {
                        ctx.fillText(str || '', x, y, maxWidth);
                    } else {
                        ctx.fillText(str || '', x, y);
                    }
                };

                const rect = (rx, ry, rw, rh) => {
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth   = 1.5;
                    ctx.strokeRect(rx, ry, rw, rh);
                };

                const drawRow = (rowY, dataRow, isOpening = false) => {
                    const { date: rDate, particulars: rParts, weight: rW, rate: rR, total: rT, cashRec: rCR, cashLess: rCL } = dataRow;
                    const vals = [rDate, rParts, rW, rR, rT, rCR, rCL];
                    vals.forEach((v, i) => {
                        let x = colStarts[i] + 10;
                        let align = 'left';
                        if (i >= 2) { x = colStarts[i] + colWidths[i] - 10; align = 'right'; }
                        if (i === 1) { x = colStarts[i] + 10; }
                        if (i === 0 || i === 2 || i === 3) { x = colStarts[i] + colWidths[i]/2; align = 'center'; }

                        let displayVal = (i === 0 && isOpening) ? String(v || '') : String(v || (i >= 2 && !isOpening ? '0' : ''));
                        if (!isOpening && (i === 3 || i === 4 || i === 5 || i === 6)) {
                            const num = Number(v);
                            if (!isNaN(num) && v !== '') {
                                displayVal = Math.round(num).toString();
                            }
                        }
                        
                        let textColor = '#000';
                        if (!isOpening) {
                            if (i === 4 && Number(v) > 0) {
                                textColor = '#b91c1c';
                            } else if (i === 5 && Number(v) > 0) {
                                const isVendor = buyer.displayId && String(buyer.displayId).startsWith('V');
                                textColor = isVendor ? '#b91c1c' : '#15803d';
                            } else if (i === 6 && Number(v) > 0) {
                                textColor = '#b91c1c';
                            }
                        }

                        const maxW = colWidths[i] - (i === 1 ? 20 : 15);
                        drawText(displayVal, x, rowY + LINE_H/2, { size: 22, align, weight: '700', maxWidth: maxW, color: textColor });
                        if (i > 0) { ctx.beginPath(); ctx.moveTo(colStarts[i], rowY); ctx.lineTo(colStarts[i], rowY + LINE_H); ctx.stroke(); }
                    });
                    ctx.beginPath(); ctx.moveTo(PAD, rowY + LINE_H); ctx.lineTo(W - PAD, rowY + LINE_H); ctx.stroke();
                };

                let y = 30;
                if (pLayout.isFirst) {
                    // Full Header
                    drawText(name, W/2, y, { size: 48, weight: '900', align: 'center' });
                    y += 45;
                    drawText(type, W/2, y, { size: 24, weight: '700', align: 'center' });
                    y += 28;
                    drawText(address, W/2, y, { size: 20, align: 'center' });
                    y += 32;

                    // Phones
                    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
                    y += 18;
                    drawText(`CELL : ${phone1}`, PAD + 10, y, { size: 20, weight: '700' });
                    drawText(`CELL : ${phone2}`, W - PAD - 10, y, { size: 20, weight: '700', align: 'right' });
                    y += 22;
                    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
                    y += 40;

                    // Title
                    drawText(statementTitle, W/2, y, { size: 30, weight: '900', align: 'center' });
                    y += 40;

                    // Customer Info
                    drawText(`${customerNoLabel} : ${buyer.displayId || '---'}`, PAD + 10, y, { size: 22, weight: '700' });
                    drawText(`${date} : ${dateLabel}`, W - PAD - 10, y, { size: 22, weight: '700', align: 'right' });
                    y += 28;
                    ctx.font = '700 22px sans-serif';
                    drawText(nameStr, PAD + 10, y, { size: 22, weight: '700', wrapWidth: W - PAD*2 - 20, lineHeight: 28 });
                    y += isNameWrapped ? 58 : 30;

                    // Double Border before table
                    ctx.beginPath(); ctx.lineWidth = 1; ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
                    y += 3;
                    ctx.beginPath(); ctx.lineWidth = 1; ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
                    y += 2;
                } else {
                    // Simplified Header for Continued Pages
                    drawText(name, PAD + 10, y + 20, { size: 28, weight: '900' });
                    drawText(`${statementTitle} (${lang === 'ta' ? 'தொடர்ச்சி' : 'Continued'})`, W/2, y + 20, { size: 20, weight: '800', align: 'center' });
                    drawText(`CELL : ${phone1}`, W - PAD - 10, y + 20, { size: 18, weight: '700', align: 'right' });
                    y += 45;
                    drawText(`${nameLabel} : ${buyer.name}  |  ${customerNoLabel} : ${buyer.displayId || '---'}`, PAD + 10, y, { size: 18, weight: '700' });
                    drawText(`${date} : ${dateLabel}`, W - PAD - 10, y, { size: 18, weight: '700', align: 'right' });
                    y += 30;
                    ctx.beginPath(); ctx.lineWidth = 1; ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
                    y += 5;
                }

                // Draw Table Header
                const tableStartY = y;
                rect(PAD, y, W - PAD*2, 40);
                colHeaders.forEach((lab, i) => {
                    const hx = colStarts[i] + colWidths[i]/2;
                    const maxW = colWidths[i] - 10;
                    drawText(lab, hx, y + 20, { size: 18, weight: '900', align: 'center', maxWidth: maxW });
                    if (i > 0) { ctx.beginPath(); ctx.moveTo(colStarts[i], y); ctx.lineTo(colStarts[i], y + 40); ctx.stroke(); }
                });
                y += 40;

                const rowsStartY = y;
                // Draw Rows for this page
                for (let idx = pLayout.startIndex; idx < pLayout.endIndex; idx++) {
                    const rowData = allRows[idx];
                    const isOpening = idx === 0;
                    const showDate = isOpening || idx === 1 || rowData.date !== allRows[idx-1].date;
                    
                    let drawRowData = { ...rowData };
                    if (!isOpening) {
                        drawRowData.date = showDate ? rowData.date : '';
                    } else {
                        drawRowData.total = fmtNum(openingBalance);
                    }
                    drawRow(y, drawRowData, isOpening);
                    y += LINE_H;
                }

                // Vertical borders for the table on this page
                rect(PAD, rowsStartY, W - PAD*2, y - rowsStartY);
                ctx.lineWidth = 1.0;
                [colStarts[1], colStarts[2], colStarts[3], colStarts[4], colStarts[5], colStarts[6]].forEach(vx => {
                    ctx.beginPath();
                    ctx.moveTo(vx, tableStartY);
                    ctx.lineTo(vx, y);
                    ctx.stroke();
                });

                // If last page, draw summary box and footer
                if (pLayout.isLast) {
                    y += 30;
                    const sumW = W - PAD*2;
                    rect(PAD, y, sumW, 130);
                    const drawSumRow = (sy, label, val, valueColor = '#000', isTotalSales = false) => {
                        drawText(label, PAD + 15, sy + 22, { size: 22, weight: '800' });
                        const displayVal = isTotalSales 
                            ? fmtNum(openingBalance + val)
                            : fmtNum(val);
                        drawText(displayVal, W - PAD - 15, sy + 22, { size: 22, weight: '900', align: 'right', color: valueColor });
                    };
                    const isVendor = buyer.displayId && String(buyer.displayId).startsWith('V');
                    drawSumRow(y,      totalSalesLabel, summary.sales, '#b91c1c', true);
                    drawSumRow(y + 42, cashRecLabel,    summary.paid, isVendor ? '#b91c1c' : '#15803d');
                    drawSumRow(y + 84, cashLessLabel,   summary.less, '#b91c1c');
                    
                    const finalBal = openingBalance + summary.sales - summary.paid - summary.less;
                    y += 125;
                    ctx.beginPath(); ctx.moveTo(PAD + 10, y); ctx.lineTo(W - PAD - 10, y); ctx.stroke();
                    drawText(finalBalLabel, PAD + 15, y + 20, { size: 26, weight: '900' });
                    drawText(fmtNum(finalBal), W - PAD - 15, y + 20, { size: 26, weight: '900', align: 'right' });
                    
                    y += 45;
                    drawText(thankYou, W/2, y, { size: 28, align: 'center' });
                }

                // Add Page number at bottom right of each page
                drawText(`${lang === 'ta' ? 'பக்கம்' : 'Page'} ${pageIdx + 1} / ${pagesLayout.length}`, W - PAD - 10, PAGE_H - 30, { size: 16, align: 'right', color: '#64748b', weight: '700' });

                canvas.toBlob((blob) => {
                    resolve({ blob, url: URL.createObjectURL(blob) });
                }, 'image/png');
            });
        });

        return Promise.all(pagePromises);
    }

    const H = 850 + (ledgerRows.length * LINE_H);
    const canvas  = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx     = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const drawText = (str, x, y, { size = 20, weight = 'normal', align = 'left', color = '#000', maxWidth, wrapWidth, lineHeight = 28 } = {}) => {
        ctx.font         = `${weight} ${size}px sans-serif`;
        ctx.fillStyle    = color;
        ctx.textAlign    = align;
        ctx.textBaseline = 'middle';
        if (wrapWidth) {
            const words = (str || '').split(' ');
            let line = '';
            let currentY = y;
            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                const testWidth = ctx.measureText(testLine).width;
                if (testWidth > wrapWidth && i > 0) {
                    ctx.fillText(line.trim(), x, currentY, wrapWidth);
                    line = words[i] + ' ';
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line.trim(), x, currentY, wrapWidth);
        } else if (maxWidth) {
            ctx.fillText(str || '', x, y, maxWidth);
        } else {
            ctx.fillText(str || '', x, y);
        }
    };

    const rect = (x, y, w, h) => {
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(x, y, w, h);
    };

    let y = 30;

    // Header
    drawText(name, W/2, y, { size: 48, weight: '900', align: 'center' });
    y += 45;
    drawText(type, W/2, y, { size: 24, weight: '700', align: 'center' });
    y += 28;
    drawText(address, W/2, y, { size: 20, align: 'center' });
    y += 32;

    // Phones
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    y += 18;
    drawText(`CELL : ${phone1}`, PAD + 10, y, { size: 20, weight: '700' });
    drawText(`CELL : ${phone2}`, W - PAD - 10, y, { size: 20, weight: '700', align: 'right' });
    y += 22;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    y += 40;

    // Title
    drawText(statementTitle, W/2, y, { size: 30, weight: '900', align: 'center' });
    y += 40;

    // Customer Info
    drawText(`${customerNoLabel} : ${buyer.displayId || '---'}`, PAD + 10, y, { size: 22, weight: '700' });
    drawText(`${date} : ${dateLabel}`, W - PAD - 10, y, { size: 22, weight: '700', align: 'right' });
    y += 28;
    ctx.font = '700 22px sans-serif';
    const nameStr = `${nameLabel} : ${buyer.name || '---'}`;
    const nameWidth = ctx.measureText(nameStr).width;
    const isNameWrapped = nameWidth > (W - PAD*2 - 20);
    
    drawText(nameStr, PAD + 10, y, { size: 22, weight: '700', wrapWidth: W - PAD*2 - 20, lineHeight: 28 });
    y += isNameWrapped ? 58 : 30;
    
    // Double Border before table
    ctx.beginPath(); ctx.lineWidth = 1; ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    y += 3;
    ctx.beginPath(); ctx.lineWidth = 1; ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    y += 2;

    // Header Row
    rect(PAD, y, W - PAD*2, 40);
    colHeaders.forEach((lab, i) => {
        const x = colStarts[i] + colWidths[i]/2;
        const maxW = colWidths[i] - 10;
        drawText(lab, x, y + 20, { size: 18, weight: '900', align: 'center', maxWidth: maxW });
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

            let displayVal = (i === 0 && isOpening) ? String(v || '') : String(v || (i >= 2 && !isOpening ? '0' : ''));
            if (!isOpening && (i === 3 || i === 4 || i === 5 || i === 6)) {
                const num = Number(v);
                if (!isNaN(num) && v !== '') {
                    displayVal = Math.round(num).toString();
                }
            }
            
            let textColor = '#000';
            if (!isOpening) {
                if (i === 4 && Number(v) > 0) {
                    textColor = '#b91c1c';
                } else if (i === 5 && Number(v) > 0) {
                    const isVendor = buyer.displayId && String(buyer.displayId).startsWith('V');
                    textColor = isVendor ? '#b91c1c' : '#15803d';
                } else if (i === 6 && Number(v) > 0) {
                    textColor = '#b91c1c';
                }
            }

            const maxW = colWidths[i] - (i === 1 ? 20 : 15);
            drawText(displayVal, x, rowY + LINE_H/2, { size: 22, align, weight: '700', maxWidth: maxW, color: textColor });
            if (i > 0) { ctx.beginPath(); ctx.moveTo(colStarts[i], rowY); ctx.lineTo(colStarts[i], rowY + LINE_H); ctx.stroke(); }
        });
        ctx.beginPath(); ctx.moveTo(PAD, rowY + LINE_H); ctx.lineTo(W - PAD, rowY + LINE_H); ctx.stroke();
    };

    const displayStartDate = startDate ? startDate.split('-').reverse().join('/') : '';
    drawRow(y, { date: displayStartDate, particulars: openingBalLabel, weight: '0.000', rate: '0', total: fmtNum(openingBalance), cashRec: '0', cashLess: '0' }, true);
    y += LINE_H;

    // Data Rows
    ledgerRows.forEach((row, idx, arr) => {
        const showDate = idx === 0 || row.date !== arr[idx-1].date;
        drawRow(y, { ...row, date: showDate ? row.date : '' });
        y += LINE_H;
    });

    // Outer Table Borders
    rect(PAD, tableStartY, W - PAD*2, y - tableStartY);

    y += 30;

    // Summary Box
    const sumW = W - PAD*2;
    rect(PAD, y, sumW, 130);
    const drawSumRow = (sy, label, val, valueColor = '#000', isTotalSales = false) => {
        drawText(label, PAD + 15, sy + 22, { size: 22, weight: '800' });
        const displayVal = isTotalSales 
            ? fmtNum(openingBalance + val)
            : fmtNum(val);
        drawText(displayVal, W - PAD - 15, sy + 22, { size: 22, weight: '900', align: 'right', color: valueColor });
    };
    const isVendor = buyer.displayId && String(buyer.displayId).startsWith('V');
    drawSumRow(y,      totalSalesLabel, summary.sales, '#b91c1c', true);
    drawSumRow(y + 42, cashRecLabel,    summary.paid, isVendor ? '#b91c1c' : '#15803d');
    drawSumRow(y + 84, cashLessLabel,   summary.less, '#b91c1c');
    
    // Final Balance Row (with different styling to stand out)
    const finalBal = openingBalance + summary.sales - summary.paid - summary.less;
    y += 125;
    ctx.beginPath(); ctx.moveTo(PAD + 10, y); ctx.lineTo(W - PAD - 10, y); ctx.stroke();
    drawText(finalBalLabel, PAD + 15, y + 20, { size: 26, weight: '900' });
    drawText(fmtNum(finalBal), W - PAD - 15, y + 20, { size: 26, weight: '900', align: 'right' });
    
    y += 45;

    // Footer
    drawText(thankYou, W/2, y, { size: 28, align: 'center' });

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({ blob, url: URL.createObjectURL(blob) });
        }, 'image/png');
    });
}

export async function generatePaymentReceiptCanvas({
    entity,
    payment,
    bizInfo = {},
    labels  = {},
    lang    = 'en'
}) {
    const {
        dateLabel = 'தேதி',
        nameLabel = 'பெயர்',
        amountLabel = 'தொகை',
        notesLabel = 'விபரம்',
        paymentReceipt = 'பணம் பெற்றுக் கொண்டமைக்கான ரசீது',
        thankYou = '🌹 நன்றி 🌹'
    } = labels;

    const W = 800;
    const H = 600;
    const PAD = 50;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const {
        motto = 'SRI RAMA JAYAM',
        name = 'S.V.M',
        type = 'SRI VALLI FLOWER MERCHANT',
        address = 'B-7, FLOWER MARKET, TINDIVANAM.',
        phone1 = '9443247771',
        phone2 = '9952535057',
    } = bizInfo;

    const drawText = (str, x, y, { size = 22, weight = 'normal', align = 'left', color = '#000', maxWidth } = {}) => {
        ctx.font = `${weight} ${size}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        if (maxWidth) ctx.fillText(str || '', x, y, maxWidth);
        else ctx.fillText(str || '', x, y);
    };

    let y = 50;
    drawText(motto, W/2, y, { size: 24, weight: '600', align: 'center' });
    y += 60;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, y, W - PAD*2, 140);
    drawText(name, W/2, y + 45, { size: 52, weight: '900', align: 'center' });
    drawText(type, W/2, y + 90, { size: 24, weight: '700', align: 'center' });
    drawText(address, W/2, y + 120, { size: 20, align: 'center' });
    y += 160;

    drawText(paymentReceipt, W/2, y, { size: 24, weight: '800', align: 'center', color: '#1e293b' });
    y += 50;

    ctx.lineWidth = 1;
    ctx.strokeRect(PAD, y, W - PAD*2, 210);
    
    const drawRow = (ly, label, value, isLast = false, valueColor = '#000') => {
        drawText(label, PAD + 20, ly + 35, { size: 22, weight: '700' });
        drawText(`:  ${value}`, PAD + 250, ly + 35, { size: 22, weight: '800', color: valueColor });
        if (!isLast) {
            ctx.beginPath(); ctx.moveTo(PAD, ly + 70); ctx.lineTo(W - PAD, ly + 70); ctx.stroke();
        }
    };

    const dArr = (payment.date || '').split('-');
    const displayDate = dArr.length === 3 ? `${dArr[2]}-${dArr[1]}-${dArr[0]}` : payment.date;

    const isVendor = payment.type === 'vendor' || (entity.displayId && String(entity.displayId).startsWith('V'));
    const amountColor = isVendor ? '#b91c1c' : '#15803d';

    drawRow(y, dateLabel, displayDate);
    drawRow(y + 70, nameLabel, (entity.nameTa && lang === 'ta') ? entity.nameTa : entity.name);
    drawRow(y + 140, amountLabel, `Rs. ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(payment.amount)}`, true, amountColor);
    
    y += 260;
    drawText(thankYou, W/2, y, { size: 28, align: 'center' });

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({ blob, url: URL.createObjectURL(blob) });
        }, 'image/png');
    });
}

export async function generatePurchaseReceiptCanvas({
    entity, // vendor
    purchase, // { date, grandTotal, items: [...] }
    bizInfo = {},
    labels  = {},
    lang    = 'en'
}) {
    const {
        dateLabel = 'தேதி',
        vendorLabel = 'விற்பனையாளர்',
        totalLabel = 'மொத்த தொகை',
        purchaseReceipt = 'கொள்முதல் ரசீது',
        particulars = 'விவரம்',
        qty = 'அளவு',
        rate = 'விலை',
        amount = 'தொகை',
        thankYou = '🌹 நன்றி 🌹'
    } = labels;

    const W = 800;
    const H = 800;
    const PAD = 50;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const {
        motto = 'SRI RAMA JAYAM',
        name = 'S.V.M',
        type = 'SRI VALLI FLOWER MERCHANT',
        address = 'B-7, FLOWER MARKET, TINDIVANAM.',
        phone1 = '9443247771',
        phone2 = '9952535057',
    } = bizInfo;

    const drawText = (str, x, y, { size = 22, weight = 'normal', align = 'left', color = '#000', maxWidth } = {}) => {
        ctx.font = `${weight} ${size}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        if (maxWidth) ctx.fillText(str || '', x, y, maxWidth);
        else ctx.fillText(str || '', x, y);
    };

    let y = 50;
    drawText(motto, W/2, y, { size: 24, weight: '600', align: 'center' });
    y += 60;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, y, W - PAD*2, 140);
    drawText(name, W/2, y + 45, { size: 52, weight: '900', align: 'center' });
    drawText(type, W/2, y + 90, { size: 24, weight: '700', align: 'center' });
    drawText(address, W/2, y + 120, { size: 20, align: 'center' });
    y += 180;

    drawText(purchaseReceipt, W/2, y, { size: 26, weight: '800', align: 'center', color: '#1e293b' });
    y += 60;

    const dArr = (purchase.date || '').split('-');
    const displayDate = dArr.length === 3 ? `${dArr[2]}-${dArr[1]}-${dArr[0]}` : purchase.date;

    drawText(`${dateLabel}: ${displayDate}`, PAD, y, { size: 22, weight: '600' });
    y += 40;
    drawText(`${vendorLabel}: ${ (entity.nameTa && lang === 'ta') ? entity.nameTa : entity.name }`, PAD, y, { size: 22, weight: '600' });
    y += 60;

    function fmtNum(n) { return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n); }

    // Table Header
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(PAD, y, W - PAD*2, 40);
    ctx.strokeRect(PAD, y, W - PAD*2, 40);
    
    drawText(particulars, PAD + 10, y + 20, { size: 18, weight: '700' });
    drawText(qty, PAD + 350, y + 20, { size: 18, weight: '700', align: 'center' });
    drawText(rate, PAD + 480, y + 20, { size: 18, weight: '700', align: 'center' });
    drawText(amount, W - PAD - 10, y + 20, { size: 18, weight: '700', align: 'right' });
    y += 40;

    // Table Rows
    const items = purchase.items || [];
    items.forEach((item, idx) => {
        const itemY = y + (idx * 40);
        ctx.strokeRect(PAD, itemY, W - PAD*2, 40);
        
        const flowerName = (item.flowerTypeTa && lang === 'ta') ? item.flowerTypeTa : item.flowerType;
        drawText(flowerName, PAD + 10, itemY + 20, { size: 18 });
        drawText(item.quantity?.toString(), PAD + 350, itemY + 20, { size: 18, align: 'center' });
        drawText(item.price?.toString(), PAD + 480, itemY + 20, { size: 18, align: 'center' });
        drawText(fmtNum(item.total), W - PAD - 10, itemY + 20, { size: 18, weight: '700', align: 'right', color: '#b91c1c' });
    });
    
    y += items.length * 40;
    y += 20;

    // Total
    ctx.strokeRect(PAD, y, W - PAD*2, 50);
    drawText(totalLabel, PAD + 10, y + 25, { size: 22, weight: '800' });
    drawText(fmtNum(purchase.grandTotal), W - PAD - 10, y + 25, { size: 22, weight: '900', align: 'right', color: '#b91c1c' });

    y += 100;
    drawText(thankYou, W/2, y, { size: 28, align: 'center' });

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({ blob, url: URL.createObjectURL(blob) });
        }, 'image/png');
    });
}
