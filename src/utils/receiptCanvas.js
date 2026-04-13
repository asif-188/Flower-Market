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
    prevBalance   = 0,
    fromDate      = '',
    toDate        = '',
    bizInfo       = {},
}) {
    const W       = 750;
    const PAD     = 40;
    const LINE_H  = 46;
    const GAP     = 14;

    const {
        motto   = '',
        name    = 'Poovanam Market',
        type    = 'Flower Merchant',
        address = '',
        phone1  = '',
        phone2  = '',
    } = bizInfo;

    const fmtNum = (n) =>
        new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

    const displayDate = (iso) => {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    };

    const dateLabel = fromDate === toDate
        ? displayDate(fromDate)
        : `${displayDate(fromDate)} - ${displayDate(toDate)}`;

    // ── Estimate total canvas height ──
    const headerRows = 4 + (address ? 1 : 0);
    const tableRows  = Math.max(salesItems.length, 1);
    const H = PAD * 2
        + headerRows  * (LINE_H - 4)
        + GAP * 3
        + LINE_H * 2           // customer + date
        + GAP * 2
        + LINE_H               // table header
        + tableRows * LINE_H
        + GAP * 2
        + LINE_H * 5           // summary rows
        + GAP * 4
        + LINE_H               // footer
        + PAD;

    // ── Create canvas ──
    const canvas  = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx     = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // ── Helpers ──
    const RIGHT  = W - PAD;
    const CENTER = W / 2;
    const LEFT   = PAD;

    const drawText = (str, x, y, { size = 26, weight = 'normal', align = 'left', color = '#111827' } = {}) => {
        ctx.font         = `${weight} ${size}px 'Noto Sans Tamil', 'Noto Sans', Arial, sans-serif`;
        ctx.fillStyle    = color;
        ctx.textAlign    = align;
        ctx.textBaseline = 'middle';
        ctx.fillText(str || '', x, y);
    };

    const hline = (y, { dash = false } = {}) => {
        ctx.beginPath();
        if (dash) ctx.setLineDash([6, 4]); else ctx.setLineDash([]);
        ctx.moveTo(LEFT, y);
        ctx.lineTo(RIGHT, y);
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth   = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
    };

    let y = PAD;

    // ══════════════════════════════════════════
    // HEADER — matches letterhead in screenshot
    // ══════════════════════════════════════════

    // Row 1: CELL left | motto center | CELL right
    const row1Y = y + LINE_H / 2;
    if (phone1) drawText(`CELL : ${phone1}`, LEFT,   row1Y, { size: 22, weight: 'normal', align: 'left',   color: '#374151' });
    if (motto)  drawText(motto,              CENTER,  row1Y, { size: 22, weight: 'normal', align: 'center', color: '#374151' });
    if (phone2) drawText(`CELL : ${phone2}`, RIGHT,   row1Y, { size: 22, weight: 'normal', align: 'right',  color: '#374151' });
    y += LINE_H;

    // Row 2: Large bold shop name
    drawText(name, CENTER, y + (LINE_H + 10) / 2, { size: 52, weight: 'bold', align: 'center', color: '#111827' });
    y += LINE_H + 10;

    // Row 3: Shop type
    drawText(type, CENTER, y + LINE_H / 2, { size: 26, weight: 'normal', align: 'center', color: '#374151' });
    y += LINE_H - 4;

    // Row 4: Address
    if (address) {
        drawText(address, CENTER, y + LINE_H / 2, { size: 24, weight: 'normal', align: 'center', color: '#374151' });
        y += LINE_H - 6;
    }

    y += GAP;
    hline(y);
    y += GAP;

    // ══════════════════════════════════════════
    // CUSTOMER & DATE
    // ══════════════════════════════════════════
    drawText(buyer.name, LEFT, y + LINE_H / 2, { size: 32, weight: 'bold', align: 'left', color: '#111827' });
    y += LINE_H;
    drawText(`தேதி : ${dateLabel}`, LEFT, y + LINE_H / 2, { size: 24, align: 'left', color: '#374151' });
    y += LINE_H;

    y += GAP;
    hline(y);
    y += GAP;

    // ══════════════════════════════════════════
    // ITEMS TABLE
    // ══════════════════════════════════════════
    const COL_VARIETY = LEFT;
    const COL_RATE    = LEFT + 280;
    const COL_TOTAL   = RIGHT;

    // Table header
    drawText('வகை',       COL_VARIETY, y + LINE_H / 2, { size: 25, weight: 'bold', align: 'left'  });
    drawText('எவிவிலை',  COL_RATE,    y + LINE_H / 2, { size: 25, weight: 'bold', align: 'left'  });
    drawText('தொகை',     COL_TOTAL,   y + LINE_H / 2, { size: 25, weight: 'bold', align: 'right' });
    y += LINE_H;
    hline(y, { dash: true });
    y += 8;

    // Table rows
    if (salesItems.length === 0) {
        drawText('பதிவுகள் இல்லை', CENTER, y + LINE_H / 2, { size: 22, align: 'center', color: '#9ca3af' });
        y += LINE_H;
    } else {
        for (const item of salesItems) {
            const rowY = y + LINE_H / 2;
            drawText(item.flowerType || '—',                         COL_VARIETY, rowY, { size: 25, align: 'left',  color: '#111827' });
            drawText(`${item.quantity} KG    ${fmtNum(item.price)}`, COL_RATE,    rowY, { size: 23, align: 'left',  color: '#374151' });
            drawText(fmtNum(item.total),                             COL_TOTAL,   rowY, { size: 25, align: 'right', color: '#111827' });
            y += LINE_H;
        }
    }

    y += GAP;
    hline(y);
    y += GAP;

    // ══════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════
    const sumRow = (label, value, { bold = false, color = '#111827' } = {}) => {
        const rowY = y + LINE_H / 2;
        drawText(label,          LEFT,      rowY, { size: 25, weight: bold ? 'bold' : 'normal', align: 'left',  color });
        drawText(fmtNum(value),  COL_TOTAL, rowY, { size: 25, weight: bold ? 'bold' : 'normal', align: 'right', color });
        y += LINE_H;
    };

    const totalDue     = salesTotal + prevBalance;
    const finalBalance = totalDue - paymentsTotal;

    sumRow('இன்றைய சரக்கு',  salesTotal);
    sumRow('முன் பாக்கி',    prevBalance);

    hline(y, { dash: true }); y += GAP;

    sumRow('மொத்தம்',        totalDue,      { bold: true });
    sumRow('வரவு',           paymentsTotal, { color: '#16a34a' });
    sumRow('பாக்கி',         finalBalance,  { bold: true, color: finalBalance > 0 ? '#dc2626' : '#16a34a' });

    y += GAP;
    hline(y);
    y += GAP + 10;

    // ══════════════════════════════════════════
    // FOOTER
    // ══════════════════════════════════════════
    drawText('🌹 நன்றி (Thank You) 🌹', CENTER, y + LINE_H / 2, { size: 26, align: 'center', color: '#374151' });

    // ── Export as PNG blob ──
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve({ blob, url: URL.createObjectURL(blob) });
        }, 'image/png');
    });
}
