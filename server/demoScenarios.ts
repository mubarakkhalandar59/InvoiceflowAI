import type { DemoScenarioId } from '../src/types/invoice.ts';

export interface DemoScenarioSpec {
  id: DemoScenarioId;
  title: string;
  subtitle: string;
  expectedOutcome: string;
  fileName: string;
  invoiceText: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotalDisplay: string;
  taxDisplay: string;
  totalDisplay: string;
  note: string;
}

export const DEMO_SCENARIOS: DemoScenarioSpec[] = [
  {
    id: 'auto_approve_low',
    title: '1. Low-Value Valid Invoice',
    subtitle: '₹6,490 · Office supplies · Clean GST & complete metadata',
    expectedOutcome: 'AUTO_APPROVED',
    fileName: 'DEMO_Apex_Stationery_INV-2026-1042.pdf',
    vendorName: 'Apex Corporate Stationery Pvt. Ltd.',
    invoiceNumber: 'INV-2026-1042',
    invoiceDate: '2026-11-10',
    dueDate: '2026-12-10',
    currency: 'INR',
    subtotalDisplay: '₹5,500.00',
    taxDisplay: '₹990.00 (18% GST)',
    totalDisplay: '₹6,490.00',
    note: 'Qualifies for autonomous approval under ₹10,000 limit.',
    invoiceText: `TAX INVOICE
Vendor: Apex Corporate Stationery Pvt. Ltd.
GSTIN: 29AABCA4821K1Z5 | Address: 42 MG Road, Bengaluru 560001
Invoice Number: INV-2026-1042
Invoice Date: 2026-11-10
Due Date: 2026-12-10
Currency: INR
Line Items:
1. A4 Laser Printer Paper (10 Boxes) - Qty: 10, Unit Price: 350.00, Amount: 3500.00
2. Ergonomic Desk Organizers (4 Units) - Qty: 4, Unit Price: 500.00, Amount: 2000.00
Subtotal: 5500.00
CGST + SGST (18%): 990.00
Total Amount Payable: 6490.00 INR
Payment Terms: Net 30 Days.`,
  },
  {
    id: 'manager_approval_mid',
    title: '2. Manager Approval Invoice',
    subtitle: '₹28,320 · Cloud infrastructure · Mid-tier spend',
    expectedOutcome: 'PENDING_MANAGER',
    fileName: 'DEMO_NimbusCloud_INV-NC-8831.pdf',
    vendorName: 'NimbusCloud India Services LLP',
    invoiceNumber: 'INV-NC-8831',
    invoiceDate: '2026-11-12',
    dueDate: '2026-12-12',
    currency: 'INR',
    subtotalDisplay: '₹24,000.00',
    taxDisplay: '₹4,320.00 (18% GST)',
    totalDisplay: '₹28,320.00',
    note: 'Clean extraction between ₹10,001 and ₹50,000; routed to Manager.',
    invoiceText: `TAX INVOICE
Vendor: NimbusCloud India Services LLP
GSTIN: 27AAFCN9012R1Z8 | Mumbai, Maharashtra
Invoice Number: INV-NC-8831
Invoice Date: 2026-11-12
Due Date: 2026-12-12
Currency: INR
Line Items:
1. Managed Kubernetes Cluster (November 2026) - Qty: 1, Unit Price: 18000.00, Amount: 18000.00
2. Automated Backup Storage 2TB - Qty: 1, Unit Price: 6000.00, Amount: 6000.00
Subtotal: 24000.00
IGST (18%): 4320.00
Total Amount: 28320.00 INR`,
  },
  {
    id: 'admin_approval_high',
    title: '3. Admin High-Value Invoice',
    subtitle: '₹1,47,500 · Security audit retainer · Above ₹50,000',
    expectedOutcome: 'PENDING_ADMIN',
    fileName: 'DEMO_VanguardSec_VS-2026-409.pdf',
    vendorName: 'Vanguard Cyber Assurance Pvt. Ltd.',
    invoiceNumber: 'VS-2026-409',
    invoiceDate: '2026-11-14',
    dueDate: '2026-12-14',
    currency: 'INR',
    subtotalDisplay: '₹1,25,000.00',
    taxDisplay: '₹22,500.00 (18% GST)',
    totalDisplay: '₹1,47,500.00',
    note: 'Exceeds ₹50,000 threshold; requires Admin approval.',
    invoiceText: `TAX INVOICE
Vendor: Vanguard Cyber Assurance Pvt. Ltd.
GSTIN: 07AABCV7114M1Z2 | Gurugram, Haryana
Invoice Number: VS-2026-409
Invoice Date: 2026-11-14
Due Date: 2026-12-14
Currency: INR
Line Items:
1. SOC 2 Type II Readiness & Penetration Testing - Qty: 1, Unit Price: 125000.00, Amount: 125000.00
Subtotal: 125000.00
GST (18%): 22500.00
Total Amount: 147500.00 INR`,
  },
  {
    id: 'duplicate_invoice',
    title: '4. Duplicate Invoice Detection',
    subtitle: '₹6,490 · Resubmitted INV-2026-1042 from Apex Stationery',
    expectedOutcome: 'ESCALATED',
    fileName: 'DEMO_DUPLICATE_Apex_INV-2026-1042.pdf',
    vendorName: 'Apex Corporate Stationery Pvt. Ltd.',
    invoiceNumber: 'INV-2026-1042',
    invoiceDate: '2026-11-10',
    dueDate: '2026-12-10',
    currency: 'INR',
    subtotalDisplay: '₹5,500.00',
    taxDisplay: '₹990.00',
    totalDisplay: '₹6,490.00',
    note: 'Same vendor & invoice number as Scenario 1; blocked & escalated.',
    invoiceText: `TAX INVOICE (RESUBMITTED COPY)
Vendor: Apex Corporate Stationery Pvt. Ltd.
GSTIN: 29AABCA4821K1Z5 | Bengaluru 560001
Invoice Number: INV-2026-1042
Invoice Date: 2026-11-10
Due Date: 2026-12-10
Currency: INR
Line Items:
1. A4 Laser Printer Paper (10 Boxes) - Qty: 10, Unit Price: 350.00, Amount: 3500.00
2. Ergonomic Desk Organizers (4 Units) - Qty: 4, Unit Price: 500.00, Amount: 2000.00
Subtotal: 5500.00
CGST + SGST (18%): 990.00
Total Amount Payable: 6490.00 INR`,
  },
  {
    id: 'missing_information',
    title: '5. Missing Mandatory Fields',
    subtitle: 'Missing invoice number & due date · Mandatory escalation',
    expectedOutcome: 'ESCALATED',
    fileName: 'DEMO_Incomplete_MeridianLogistics.jpg',
    vendorName: 'Meridian Freight & Logistics',
    invoiceNumber: 'MISSING',
    invoiceDate: '2026-11-15',
    dueDate: 'MISSING',
    currency: 'INR',
    subtotalDisplay: '₹7,200.00',
    taxDisplay: '₹1,296.00',
    totalDisplay: '₹8,496.00',
    note: 'Under ₹10,000, yet escalated because required fields are absent.',
    invoiceText: `FREIGHT BILL
Vendor: Meridian Freight & Logistics (Chennai Port Road)
Invoice Number: [NOT PROVIDED / BLANK]
Invoice Date: 2026-11-15
Due Date: [BLANK]
Currency: INR
Line Items:
1. Express Air Cargo Parcel Delivery - Qty: 1, Unit Price: 7200.00, Amount: 7200.00
Subtotal: 7200.00
GST (18%): 1296.00
Total Amount: 8496.00 INR`,
  },
  {
    id: 'calculation_mismatch',
    title: '6. Calculation Mismatch',
    subtitle: 'Subtotal + Tax = ₹9,440, but billed Total = ₹12,940',
    expectedOutcome: 'ESCALATED',
    fileName: 'DEMO_ArithmeticError_KinetixEvents.pdf',
    vendorName: 'Kinetix Corporate Events',
    invoiceNumber: 'KE-2026-774',
    invoiceDate: '2026-11-16',
    dueDate: '2026-12-01',
    currency: 'INR',
    subtotalDisplay: '₹8,000.00',
    taxDisplay: '₹1,440.00',
    totalDisplay: '₹12,940.00 (MISMATCH)',
    note: 'Overbilled by ₹3,500; deterministic arithmetic check catches mismatch.',
    invoiceText: `TAX INVOICE
Vendor: Kinetix Corporate Events
Address: Hyderabad, Telangana
Invoice Number: KE-2026-774
Invoice Date: 2026-11-16
Due Date: 2026-12-01
Currency: INR
Line Items:
1. Townhall Audio-Visual Setup - Qty: 1, Unit Price: 8000.00, Amount: 8000.00
Subtotal: 8000.00
GST (18%): 1440.00
Total Amount Due: 12940.00 INR`,
  },
  {
    id: 'low_confidence',
    title: '7. Low Extraction Confidence',
    subtitle: 'Blurry thermal receipt scan · Confidence < 0.90 threshold',
    expectedOutcome: 'ESCALATED',
    fileName: 'DEMO_BlurryScan_MetroCatering.png',
    vendorName: 'Metro Executive Catering (faded)',
    invoiceNumber: 'MC-991?',
    invoiceDate: '2026-11-18',
    dueDate: '2026-11-28',
    currency: 'INR',
    subtotalDisplay: '₹4,200.00',
    taxDisplay: '₹210.00',
    totalDisplay: '₹4,410.00',
    note: 'Damaged thermal scan yields confidence below 0.90; escalated.',
    invoiceText: `[LOW QUALITY FADED THERMAL RECEIPT SCAN - PARTIALLY ILLEGIBLE / SMUDGED INK]
Vendor: M?tro Exec?tive C?tering (blurred address)
Invoice No: MC-991? (last digit smudged and uncertain)
Date: 2026-11-18 (partially faded)
Due Date: 2026-11-28
Currency: INR
Subtotal: ~4200.00 (ink smear on digits)
Tax (5%): ~210.00
Total: 4410.00 INR
Note to extractor: Document scan quality is severely degraded and ambiguous; confidence must be scored low (< 0.75).`,
  },
];

export function renderDemoInvoiceSvgDataUrl(spec: DemoScenarioSpec): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="520" viewBox="0 0 760 520">
    <rect width="760" height="520" fill="#F8FAFC"/>
    <rect x="24" y="24" width="712" height="472" rx="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
    <rect x="24" y="24" width="712" height="72" rx="8" fill="#0F172A"/>
    <text x="48" y="64" font-family="sans-serif" font-size="20" font-weight="700" fill="#F8FAFC">SYNTHETIC DEMO INVOICE</text>
    <text x="530" y="64" font-family="monospace" font-size="14" font-weight="600" fill="#A5B4FC">${esc(spec.invoiceNumber)}</text>
    <text x="48" y="132" font-family="sans-serif" font-size="11" font-weight="700" fill="#64748B">VENDOR</text>
    <text x="48" y="156" font-family="sans-serif" font-size="17" font-weight="700" fill="#0F172A">${esc(spec.vendorName)}</text>
    <text x="48" y="200" font-family="sans-serif" font-size="11" font-weight="700" fill="#64748B">INVOICE DATE</text>
    <text x="48" y="222" font-family="monospace" font-size="14" fill="#0F172A">${esc(spec.invoiceDate)}</text>
    <text x="260" y="200" font-family="sans-serif" font-size="11" font-weight="700" fill="#64748B">DUE DATE</text>
    <text x="260" y="222" font-family="monospace" font-size="14" fill="#0F172A">${esc(spec.dueDate)}</text>
    <text x="480" y="200" font-family="sans-serif" font-size="11" font-weight="700" fill="#64748B">CURRENCY</text>
    <text x="480" y="222" font-family="monospace" font-size="14" fill="#0F172A">${esc(spec.currency)}</text>
    <line x1="48" y1="252" x2="712" y2="252" stroke="#E2E8F0" stroke-width="1"/>
    <text x="48" y="286" font-family="sans-serif" font-size="13" fill="#475569">Subtotal</text>
    <text x="540" y="286" font-family="monospace" font-size="14" font-weight="600" fill="#0F172A">${esc(spec.subtotalDisplay)}</text>
    <text x="48" y="320" font-family="sans-serif" font-size="13" fill="#475569">Tax Amount</text>
    <text x="540" y="320" font-family="monospace" font-size="14" font-weight="600" fill="#0F172A">${esc(spec.taxDisplay)}</text>
    <line x1="48" y1="344" x2="712" y2="344" stroke="#E2E8F0" stroke-width="1"/>
    <text x="48" y="382" font-family="sans-serif" font-size="16" font-weight="700" fill="#0F172A">Total Payable</text>
    <text x="520" y="382" font-family="monospace" font-size="18" font-weight="700" fill="#4F46E5">${esc(spec.totalDisplay)}</text>
    <rect x="48" y="420" width="664" height="52" rx="6" fill="#F1F5F9"/>
    <text x="64" y="451" font-family="sans-serif" font-size="12" fill="#334155">Scenario Note: ${esc(spec.note)}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}
