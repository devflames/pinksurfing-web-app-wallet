'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { businessLogoUrl } from '@/components/profile/ProfileAvatarStack';
import { QrDisplay } from '@/components/profile/QrDisplay';
import { useWalletIdentity } from '@/hooks/use-wallet-identity';
import { nextInvoiceNumber } from '@/lib/invoice-storage';
import { taxRateForZip } from '@/lib/invoice-tax';
import { invoiceSenderForUser } from '@/lib/profile-contact';
import { withBasePath } from '@/lib/base-path';

type LineItem = {
  id: string;
  quantity: string;
  details: string;
  pricePerUnit: string;
};

function formatIssueDate(d = new Date()): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  return `${months[d.getMonth()]}.${day}.${d.getFullYear()}`;
}

function parseNum(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function lineAmount(item: LineItem): number {
  return parseNum(item.quantity) * parseNum(item.pricePerUnit);
}

function newLineItem(): LineItem {
  return { id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, quantity: '', details: '', pricePerUnit: '' };
}

function buildPayQr(pspayId: string | undefined, chiaAddress: string, invoiceNo: string, total: number): string {
  const amt = total.toFixed(2);
  if (pspayId) {
    return `https://pinksurfing.com/pay/${encodeURIComponent(pspayId)}?invoice=${invoiceNo}&amount=${amt}`;
  }
  if (chiaAddress.trim()) return chiaAddress.trim();
  return `https://pinksurfing.com/app?invoice=${invoiceNo}&amount=${amt}`;
}

type Props = {
  onBack: () => void;
};

export function CreateInvoiceScreen({ onBack }: Props) {
  const { user } = useAuth();
  const { pspayId, chiaAddress, email } = useWalletIdentity();
  const sender = invoiceSenderForUser(user);
  const logoUrl = businessLogoUrl(user) || withBasePath('/nav/explore.png');

  const [invoiceNo] = useState(() => nextInvoiceNumber(email));
  const [issueDate] = useState(() => formatIssueDate());
  const [dueDate, setDueDate] = useState('');
  const [toName, setToName] = useState('');
  const [toStreet, setToStreet] = useState('');
  const [toCity, setToCity] = useState('');
  const [toState, setToState] = useState('');
  const [toZip, setToZip] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [description, setDescription] = useState('');
  const [discount, setDiscount] = useState('0');
  const [shipping, setShipping] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [taxHint, setTaxHint] = useState<string | null>(null);

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + lineAmount(item), 0),
    [lineItems]
  );

  const discountAmt = parseNum(discount);
  const shippingAmt = parseNum(shipping);
  const taxPct = parseNum(taxRate);
  const taxable = Math.max(0, subtotal - discountAmt + shippingAmt);
  const taxAmt = taxable * (taxPct / 100);
  const total = taxable + taxAmt;

  const qrValue = buildPayQr(pspayId, chiaAddress, invoiceNo, total);

  useEffect(() => {
    const zip = toZip.replace(/\D/g, '').slice(0, 5);
    if (zip.length !== 5) {
      setTaxHint(null);
      return;
    }

    let cancelled = false;
    void taxRateForZip(zip).then((rate) => {
      if (cancelled || rate == null) return;
      setTaxRate(String(rate));
      setTaxHint(`Auto-filled ${rate}% for ZIP ${zip}`);
    });

    return () => {
      cancelled = true;
    };
  }, [toZip]);

  const updateLine = (id: string, field: keyof Omit<LineItem, 'id'>, value: string) => {
    setLineItems((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addLine = () => setLineItems((rows) => [...rows, newLineItem()]);

  const removeLine = (id: string) => {
    setLineItems((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));
  };

  return (
    <div className="ps-invoice">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-[11px] text-[var(--ps-cyan)] hover:underline"
      >
        ← Back to Explore
      </button>

      <div className="ps-invoice-sheet overflow-hidden rounded-2xl border border-[var(--ps-brd)]">
        {/* Header — equal thirds: logo | invoice meta | sender */}
        <div className="ps-invoice-header grid grid-cols-3 border-b border-[var(--ps-brd)]/60 p-3 sm:p-4">
          <div className="flex items-start justify-center pt-0.5 sm:justify-start sm:pl-2">
            <div className="ps-invoice-logo overflow-hidden rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            </div>
          </div>

          <div className="flex items-start justify-center px-1 sm:px-2">
            <div className="ps-invoice-meta w-full max-w-[168px] text-left sm:max-w-[180px] sm:pl-3">
              <div className="text-[13px] font-bold text-[var(--ps-white)]">Invoice {invoiceNo}</div>
              <div className="text-[9px] text-[var(--ps-dim)]">Issue Date:</div>
              <div className="text-[10px] text-[var(--ps-muted)]">{issueDate}</div>
              <div className="mt-2 text-[9px] text-[var(--ps-dim)]">Due Date:</div>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="Dec.22.2026"
                className="ps-invoice-due-input mt-0.5 w-full max-w-[140px] rounded-md border-2 border-[#ff1493] bg-transparent px-2 py-1 text-[10px] text-[var(--ps-white)] outline-none"
              />
            </div>
          </div>

          <div className="min-w-0 border-l border-[var(--ps-brd)]/40 pl-3 sm:pl-4">
            <div className="text-[11px] font-semibold leading-tight text-[var(--ps-white)]">{sender.name}</div>
            <div className="text-[9px] text-[var(--ps-muted)]">{sender.position}</div>
            <hr className="my-1.5 border-[var(--ps-brd)]/50" />
            <div className="text-[8px] leading-snug text-[var(--ps-muted)]">{sender.address}</div>
            <hr className="my-1.5 border-[var(--ps-brd)]/50" />
            <div className="text-[9px] text-[var(--ps-white)]">{sender.phone}</div>
            <hr className="my-1.5 border-[var(--ps-brd)]/50" />
            <div className="break-all text-[8px] text-[var(--ps-muted)]">{sender.email}</div>
          </div>
        </div>

        {/* To + running total */}
        <div className="grid grid-cols-2 gap-3 bg-[#2a1a3d] px-3 py-3 sm:px-4">
          <div>
            <div className="mb-1 text-[10px] font-medium text-[var(--ps-white)]">To:</div>
            <input
              type="text"
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              placeholder="Recipient name"
              className="ps-invoice-input mb-1.5 w-full"
            />
            <input
              type="text"
              value={toStreet}
              onChange={(e) => setToStreet(e.target.value)}
              placeholder="Address"
              className="ps-invoice-input mb-1.5 w-full"
            />
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.55fr)_minmax(0,0.7fr)] gap-1.5">
              <input
                type="text"
                value={toCity}
                onChange={(e) => setToCity(e.target.value)}
                placeholder="City"
                className="ps-invoice-input w-full"
              />
              <input
                type="text"
                value={toState}
                onChange={(e) => setToState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="ST"
                maxLength={2}
                className="ps-invoice-input w-full uppercase"
              />
              <input
                type="text"
                inputMode="numeric"
                value={toZip}
                onChange={(e) => setToZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="ZIP"
                maxLength={5}
                className="ps-invoice-input w-full"
              />
            </div>
          </div>
          <div className="text-right">
            <div className="mb-1 text-[10px] font-medium text-[var(--ps-white)]">Total:</div>
            <div className="ps-invoice-total-pill ml-auto inline-block min-w-[100px] px-4 py-2 text-[12px] font-semibold">
              {money(total)}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="px-3 py-3 sm:px-4">
          <div className="mb-2 grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_28px] gap-1 text-[9px] font-semibold text-[var(--ps-white)] sm:gap-2">
            <span>Quantity</span>
            <span>Details</span>
            <span>Price/Unit</span>
            <span>Amount</span>
            <button
              type="button"
              onClick={addLine}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ff1493] text-[14px] font-bold leading-none text-white hover:opacity-90"
              aria-label="Add line item"
            >
              +
            </button>
          </div>

          <div className="space-y-2">
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_28px] gap-1 sm:gap-2"
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(e) => updateLine(item.id, 'quantity', e.target.value)}
                  className="ps-invoice-input"
                  placeholder="0"
                />
                <input
                  type="text"
                  value={item.details}
                  onChange={(e) => updateLine(item.id, 'details', e.target.value)}
                  className="ps-invoice-input"
                  placeholder="Item description"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={item.pricePerUnit}
                  onChange={(e) => updateLine(item.id, 'pricePerUnit', e.target.value)}
                  className="ps-invoice-input"
                  placeholder="0.00"
                />
                <div className="flex items-center px-2 text-[10px] text-[var(--ps-white)]">
                  {money(lineAmount(item))}
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(item.id)}
                  className="text-[10px] text-[var(--ps-dim)] hover:text-[var(--ps-red)]"
                  aria-label="Remove line"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Description + adjustments */}
        <div className="relative border-t border-[var(--ps-brd)]/40 px-3 py-3 sm:px-4">
          <div
            className="pointer-events-none absolute right-6 top-6 text-[80px] opacity-[0.06]"
            aria-hidden
          >
            ₿
          </div>
          <div className="mb-3 text-[10px] font-medium text-[var(--ps-white)]">Description:</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Summary of services or products above…"
            className="ps-invoice-textarea mb-4 w-full"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {(
                [
                  ['Discount', discount, setDiscount],
                  ['Shipping Handle', shipping, setShipping],
                  ['Tax Rate', taxRate, setTaxRate],
                ] as const
              ).map(([label, val, setVal]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-[110px] shrink-0 text-[9px] text-[var(--ps-muted)]">{label}</span>
                  <span className="text-[var(--ps-dim)]">—</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    className="ps-invoice-input max-w-[80px] flex-1 text-right"
                  />
                  {label === 'Tax Rate' && <span className="text-[9px] text-[var(--ps-dim)]">%</span>}
                </div>
              ))}
              {taxHint && <p className="text-[8px] text-[var(--ps-cyan)]">{taxHint}</p>}
              <div className="pt-1 text-[9px] text-[var(--ps-dim)]">
                Subtotal {money(subtotal)}
                {taxAmt > 0 && ` · Tax ${money(taxAmt)}`}
              </div>
            </div>
            <div className="text-right">
              <div className="mb-1 text-[10px] font-medium text-[var(--ps-white)]">Total:</div>
              <div className="ps-invoice-total-pill ml-auto inline-block min-w-[110px] px-5 py-2.5 text-[13px] font-bold">
                {money(total)}
              </div>
            </div>
          </div>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center border-t border-[var(--ps-brd)]/40 px-4 py-6">
          <QrDisplay value={qrValue} size={160} fgColor="#ff1493" />
          <p className="mt-3 max-w-xs text-center text-[9px] text-[var(--ps-dim)]">
            Scan with the PinkSurfing app to pay this invoice
            {pspayId ? ` · ${pspayId}` : chiaAddress ? ' · wallet address' : ''}
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#ff1493] px-3 py-2.5 sm:px-4">
          <p className="text-[9px] font-medium leading-snug text-black sm:text-[10px]">
            Can&apos;t scan &amp; Pay?{' '}
            <a
              href="https://pinksurfing.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80"
            >
              Download the app
            </a>{' '}
            or pay at{' '}
            <a
              href="https://pinksurfing.com/app"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80"
            >
              pinksurfing.com/app
            </a>
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-lg" aria-hidden>
              ₿
            </span>
            <span className="text-[11px] font-black tracking-wide text-black">PINKSURFING</span>
          </div>
        </div>
      </div>
    </div>
  );
}
