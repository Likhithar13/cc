# Security Specification & Payload-First TDD (`firestore.rules`)

## 1. Data Invariants
1. **Master Auth Gate**: Unauthenticated or unverified (`email_verified != true`) requests have zero read or write access to any collection.
2. **Self-Assigned Role Prevention**: A non-admin user registering `/users/{uid}` may only create `role == 'staff'` and `status == 'pending'`; only an active Admin (or bootstrapped admin `liikhithaa13@gmail.com`) may assign `role == 'admin'` or activate/disable accounts.
3. **PII Isolation**: `users` and `donors` contain PII (`email`, `phone`, `contactNumber`, `address`). `users` reads are restricted to `isOwner(userId) || isAdmin()`. `donors` reads/writes are restricted strictly to active `admin` or active `staff`, and `delete` is restricted to `admin`.
4. **Non-Negative Stock Invariant**: `blood_inventory` `unitsAvailable` must always be `>= 0` and `<= initialUnits` (or bounded `<= 10000`).
5. **Immutable Audit Ledger**: `blood_transactions` and `activity_logs` are append-only (`update` and `delete` denied for all users, except admin cleanup if explicitly required — kept `false` for strict audit immutability).
6. **Terminal State Locking**: Once a `blood_requests` document reaches `'fulfilled'` or `'rejected'`, non-admin users cannot modify it.
7. **Relational Integrity**: `donations` creation verifies that the referenced `donorId` exists in `/donors/{donorId}` and `inventoryBatchId` exists in `/blood_inventory/{inventoryBatchId}` (via `exists()` or `existsAfter()` for atomic batch creation).
8. **Temporal Integrity**: `createdAt` and `updatedAt` must match `request.time`, and `createdAt` / `createdBy` are immutable on updates.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)
1. **Unauthenticated Donor Read**: Anonymous request `get /donors/donor_1` -> DENIED.
2. **Unverified Email Admin Spoof**: Token with `email: "liikhithaa13@gmail.com"` and `email_verified: false` -> DENIED.
3. **Self-Escalation on Registration**: New user `uid_x` creating `/users/uid_x` with `{ role: "admin", status: "active" }` -> DENIED.
4. **Profile Role Escalation Update**: Staff user updating own `/users/uid_x` with `{ role: "admin" }` -> DENIED.
5. **Pending Staff Data Scrape**: User with `role: "staff", status: "pending"` listing `/donors` -> DENIED.
6. **Shadow Field Injection on Donor**: Active staff creating `/donors/d1` with extra ghost field `{ isVip: true }` -> DENIED.
7. **Negative Stock Manipulation**: Active staff updating `/blood_inventory/b1` with `{ unitsAvailable: -5 }` -> DENIED.
8. **Blood Request Terminal State Tamper**: Active staff updating a `'fulfilled'` request back to `'pending'` -> DENIED.
9. **Orphaned Donation Injection**: Active staff creating `/donations/don1` with non-existent `donorId: "fake_donor_999"` -> DENIED.
10. **Audit Ledger Tampering**: Staff or Admin attempting to `update` or `delete` `/blood_transactions/tx1` or `/activity_logs/log1` -> DENIED.
11. **Path ID Poisoning**: Creating `/donors/../../../etc/passwd` or 500-char ID -> DENIED by `isValidId()`.
12. **Non-Admin Settings Override / AI Report Forgery**: Staff attempting to update `/system_settings/thresholds` or create `/ai_reports/r1` -> DENIED (Admin-only for reports & settings).
