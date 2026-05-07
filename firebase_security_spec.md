# Firebase Security Specification - SGE Psicologia

## 1. Data Invariants
- Every record created by a tenant (School/Professional) MUST be associated with their `ownerId` (UID).
- Users with `role` as 'admin' or 'super-admin' (global admins) can access all data.
- Standard users can ONLY access data where `ownerId == request.auth.uid` or `professionalId == request.auth.uid`.
- Public documents (like Scheduling Requests from students) must be linked to a valid school which determines their tenant context.

## 2. The "Dirty Dozen" Payloads (Denial Expected)

1. **Identity Theft (Collection: students)**
   - Payload: `{ "name": "Fake Student", "ownerId": "attacker_uid", "ra": "123" }`
   - Attempt: Create in `students` with a different `ownerId` than current auth.
2. **Global Scraper (Collection: schools)**
   - Query: `getDocs(collection(db, 'schools'))` without `.where('ownerId')` filter.
   - Expected: `PERMISSION_DENIED`.
3. **Privilege Escalation (Collection: users)**
   - Payload: `{ "role": "admin" }`
   - Attempt: Update own user profile to change role to admin.
4. **Orphaned Writes (Collection: appointments)**
   - Payload: `{ "studentId": "non_existent", "ownerId": "valid_uid" }`
   - Attempt: Create appointment for a student ID that doesn't exist or belongs to another tenant.
5. **PII Breach (Collection: users)**
   - Attempt: Authenticated user (non-admin) trying to `get()` another user's document.
6. **Shadow Fields (Collection: letterheads)**
   - Payload: `{ "name": "Fake", "logoUrl": "...", "ownerId": "my_uid", "isVerified": true }`
   - Attempt: Inject `isVerified` field not in schema.
7. **Cross-Tenant Update (Collection: students)**
   - Attempt: User A updates `ownerId` of a student belonging to User B.
8. **Public Leak (Collection: anon_reports)**
   - Query: Any non-admin user trying to `list()` anonymous reports.
9. **Admin Spoofing**
   - Attempt: User setting `email` in payload to match global admin in hopes of tricking rules (rules must use `request.auth.token.email`).
10. **Resource Poisoning**
    - Payload: `{ "id": "A".repeat(2000) }`
    - Attempt: Create document with massive ID.
11. **Outcome Manipulation**
    - Payload: `{ "status": "approved" }`
    - Attempt: Update scheduling request status without permissions.
12. **Trial Bypass**
    - Attempt: A trial user trying to create more schools than their limit (enforced by `trialLimits`).

## 3. Implementation Plan

- **Phase 1**: Update `src/lib/api.ts` to ensure `ownerId` is added to ALL entities that should be isolated (including Categories and Appointment Types).
- **Phase 2**: Implement strict `firestore.rules` using the "Master Gate" pattern.
- **Phase 3**: Update frontend to handle these mandatory filters.

