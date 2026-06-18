const BRAND_PRIMARY = "#2C57F2";
const BRAND_SECONDARY = "#3D67FF";

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  description: string;
  amount: number;
  status: string;
  paypalTransactionId?: string;
  currency?: string;
}

export function generateInvoiceHtml(data: InvoiceData): string {
  const esc = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const sym = data.currency === "USD" || !data.currency ? "$" : data.currency;

  const statusColors: Record<string, { bg: string; color: string }> = {
    paid: { bg: "#e8f5e9", color: "#2e7d32" },
    pending: { bg: "#fff8e1", color: "#f57f17" },
    failed: { bg: "#ffebee", color: "#c62828" },
    refunded: { bg: "#e3f2fd", color: "#1565c0" },
  };
  const badge = statusColors[data.status] || statusColors.paid;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${esc(data.invoiceNumber)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #fff;
      color: #18181b;
      padding: 0;
      margin: 0;
    }

    .page {
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .header {
      background: #16171A;
      padding: 24px 48px 20px;
    }
    .gradient-line {
      height: 3px;
      background: linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_SECONDARY} 100%);
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .logo {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: ${BRAND_PRIMARY};
    }
    .header-right { text-align: right; }
    .invoice-label {
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .invoice-num {
      font-size: 13px;
      color: #888888;
      margin-top: 4px;
      font-weight: 500;
    }

    /* ── Content ── */
    .content {
      flex: 1;
      padding: 28px 48px;
    }

    /* ── Meta ── */
    .meta-grid {
      display: flex;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .meta-col-right { text-align: right; }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #9ca3af;
      margin-bottom: 4px;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 500;
      color: #18181b;
    }
    .meta-value-muted {
      font-size: 12px;
      font-weight: 400;
      color: #6b7280;
    }
    .meta-group { margin-bottom: 10px; }

    .status-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: ${badge.bg};
      color: ${badge.color};
    }

    /* ── Divider ── */
    .divider {
      height: 1px;
      background: #e5e7eb;
      margin: 0 0 20px;
    }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; }
    thead th {
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #9ca3af;
      padding: 0 0 12px;
      border-bottom: 2px solid #e5e7eb;
    }
    .th-right { text-align: right; }
    tbody td {
      padding: 12px 0;
      font-size: 13px;
      border-bottom: 1px solid #f3f4f6;
    }
    .td-right { text-align: right; }
    .td-desc { font-weight: 500; }
    .td-amount { font-weight: 600; }

    /* ── Totals ── */
    .totals {
      margin-top: 18px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-inner { width: 280px; }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
      color: #6b7280;
    }
    .totals-row-total {
      display: flex;
      justify-content: space-between;
      border-top: 2px solid #18181b;
      margin-top: 8px;
      padding-top: 14px;
      font-size: 17px;
      font-weight: 700;
      color: #18181b;
    }
    .total-amount { color: ${BRAND_PRIMARY}; }

    /* ── Payment info ── */
    .payment-info {
      margin-top: 20px;
      padding: 14px 20px;
      background: #f9fafb;
      border-radius: 10px;
      border: 1px solid #f3f4f6;
    }
    .payment-info-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #9ca3af;
      margin-bottom: 10px;
    }
    .payment-info-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #6b7280;
      padding: 5px 0;
    }
    .payment-info-val {
      font-weight: 500;
      color: #18181b;
      font-family: monospace;
      font-size: 12px;
    }

    /* ── Footer ── */
    .footer {
      padding: 16px 48px;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      margin-top: auto;
    }
    .footer-text {
      font-size: 12px;
      color: #9ca3af;
    }
    .footer-link {
      color: ${BRAND_PRIMARY};
      text-decoration: none;
      font-weight: 500;
    }

    @media print {
      .header, .gradient-line, .status-badge, .footer {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-row">
        <div class="logo">Imagick.ai</div>
        <div class="header-right">
          <div class="invoice-label">INVOICE</div>
          <div class="invoice-num">${esc(data.invoiceNumber)}</div>
        </div>
      </div>
    </div>
    <div class="gradient-line"></div>

    <div class="content">
      <div class="meta-grid">
        <div class="meta-col-left">
          <div class="meta-group">
            <div class="meta-label">Bill to</div>
            <div class="meta-value">${esc(data.customerName)}</div>
            <div class="meta-value-muted">${esc(data.customerEmail)}</div>
          </div>
        </div>
        <div class="meta-col-right">
          <div class="meta-group">
            <div class="meta-label">Invoice date</div>
            <div class="meta-value">${esc(data.date)}</div>
          </div>
          <div class="meta-group">
            <div class="meta-label">Status</div>
            <div><span class="status-badge">${esc(data.status)}</span></div>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="th-right">Qty</th>
            <th class="th-right">Unit Price</th>
            <th class="th-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="td-desc">${esc(data.description)}</td>
            <td class="td-right">1</td>
            <td class="td-right td-amount">${sym}${data.amount.toFixed(2)}</td>
            <td class="td-right td-amount">${sym}${data.amount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-inner">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>${sym}${data.amount.toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>Tax (0%)</span>
            <span>${sym}0.00</span>
          </div>
          <div class="totals-row-total">
            <span>Total</span>
            <span class="total-amount">${sym}${data.amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      ${data.paypalTransactionId ? `
      <div class="payment-info">
        <div class="payment-info-title">Payment details</div>
        <div class="payment-info-row">
          <span>Payment method</span>
          <span class="payment-info-val">PayPal</span>
        </div>
        <div class="payment-info-row">
          <span>Transaction ID</span>
          <span class="payment-info-val">${esc(data.paypalTransactionId)}</span>
        </div>
      </div>
      ` : ""}
    </div>

    <div class="footer">
      <p class="footer-text">Imagick.ai &nbsp;&middot;&nbsp; <a href="https://imagick.ai" class="footer-link">imagick.ai</a></p>
      <p class="footer-text" style="margin-top: 4px;">Thank you for your business.</p>
    </div>
  </div>
</body>
</html>`;
}
