# InvoiceFlow AI — Firestore Security Specification

## 1. Data Invariants
1. Every user profile in `/users/{userId}` must match `request.auth.uid`, require `email_verified == true`, and default to `role == 'EMPLOYEE'` on creation unless the caller is the bootstrapped admin email (`mubarakkhalandar59@gmail.com`).
2. Users can never elevate their own `role` field. Only an `ADMIN` can change user roles.
3. Every invoice in `/invoices/{invoiceId}` must have `ownerId == request.auth.uid` on creation, server timestamps (`request.time`), and cannot be created directly in a `HUMAN_APPROVED` or `REJECTED` state.
4. `AUTO_APPROVED` invoices at creation must satisfy strict data invariants (`confidence >= 0.90`, `missingFields.size() == 0`, `riskFlags.size() == 0`, `arithmeticValid == true`, `duplicateDetected == false`).
5. Employees can never approve or reject any invoice; Managers cannot approve their own real invoices; terminal invoice states (`HUMAN_APPROVED`, `REJECTED`, `AUTO_APPROVED`) are locked unless overridden by an `ADMIN`.
6. `/invoice_documents/{invoiceId}` is strictly isolated to the owner, Managers, and Admins (never public).
7. `/workflow_rules/{ruleId}` is readable by verified signed-in users and writable strictly by `ADMIN`.
8. `/audit_logs/{logId}` is strictly append-only (`update` and `delete` permanently denied for all roles).

## 2. Adversarial "Dirty Dozen" Payloads Blocked by Rules
1. **Unauthenticated Read/Write**: Reading `/invoices` or writing `/users` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: Calling with `email: 'mubarakkhalandar59@gmail.com'` and `email_verified: false` -> `PERMISSION_DENIED`.
3. **Self-Role Escalation on Registration**: Creating `/users/{uid}` with `role: 'ADMIN'` as a standard user -> `PERMISSION_DENIED`.
4. **Self-Role Escalation on Update**: Updating own `/users/{uid}` document to `role: 'MANAGER'` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Creating `/invoices/{id}` with an extra undocumented field `isAdminBypass: true` -> `PERMISSION_DENIED` (`hasOnly` check).
6. **ID Poisoning**: Writing to `/invoices/bad$id/with/spaces` or a >128 char document ID -> `PERMISSION_DENIED` (`isValidId`).
7. **PII Snooping**: An `EMPLOYEE` reading another user's `/users/{otherUid}` document -> `PERMISSION_DENIED`.
8. **Cross-Owner Invoice Read**: An `EMPLOYEE` reading or listing another employee's `/invoices/{otherInvoiceId}` -> `PERMISSION_DENIED`.
9. **Employee Self-Approval**: An `EMPLOYEE` updating their own invoice status from `PENDING_MANAGER` to `HUMAN_APPROVED` -> `PERMISSION_DENIED`.
10. **Forged Auto-Approval**: Creating an invoice with `status: 'AUTO_APPROVED'` while `duplicateDetected: true` or `confidence: 0.55` -> `PERMISSION_DENIED`.
11. **Terminal State Tampering**: A `MANAGER` attempting to alter a `REJECTED` or `HUMAN_APPROVED` invoice -> `PERMISSION_DENIED`.
12. **Audit Log Tampering**: Any user (including `ADMIN`) attempting to `update` or `delete` `/audit_logs/{logId}` -> `PERMISSION_DENIED`.
