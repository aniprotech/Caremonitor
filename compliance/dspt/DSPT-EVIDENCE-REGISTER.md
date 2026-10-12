# Caremonitor DSPT evidence register

**Organisation:** ANIKA IT SOLUTIONS LIMITED  
**ODS code:** W4L8U  
**Service:** Caremonitor  
**Assessment year:** 2026-27  
**Issue date:** 12 October 2026  
**Approved date:** To be completed by the authorised officer  
**Next review date:** 12 October 2027  
**Status:** Working register. Do not mark a DSPT assertion as met until the linked evidence is current, approved and retained.

## How to use this register

For each evidence item, attach the final approved document or record, name the owner, record the date checked and retain the source in a controlled compliance location. A policy does not prove that a control operates; add operational records as stated below.

| DSPT area | Required evidence | Caremonitor source evidence | Organisation evidence still required | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| 1.1 Lawfulness and transparency | ICO number, data-flow record, published privacy notice, asset inventory, named roles, consent review | Security and privacy source controls; audit and retention code | ICO entry, approved privacy notice, current asset/data-flow inventory, consent review record | IG Lead | Open |
| 1.2 Individual rights | DSAR, objection, correction, export and erasure process | Export, correction, erasure and legal-hold workflows | Published request route, request log, handling procedure and training record | Privacy Lead | Open |
| 1.3 Governance | Approved policies, risk register, SIRO assignment, DPIA process | `DSPT-CAREM0NITOR-SECURITY-CONTROLS.md` | Board or director approval, risk register, DPIA register, SIRO appointment | SIRO | Open |
| 1.4 Records | Records-management policy and retention schedule | Tenant-scoped retention controls | Approved retention schedule and disposal review | IG Lead | Open |
| 2.2 Staff responsibilities | Security clauses in employment contracts | N/A | Current contract template and signed contracts | Director / HR | Open |
| 3.1 Training | Mandatory training needs analysis, completion and evaluation | Caremonitor training feature can record team evidence | Training matrix, completion certificates and annual evaluation | IG Lead | Open |
| 4.1-4.5 Access | User/role record, access reviews, MFA policy, privileged access control, audit logs | Role/tenant scoping, device sessions, audit trails, TOTP MFA support | Quarterly access-review record, MFA enforcement report, approved exceptions | Technical Lead | Partly evidenced |
| 5 Process reviews | Root-cause analysis and lessons-learned record | Audit events and governance features | Incident/near-miss review minutes and action log | SIRO | Open |
| 6 Incidents and protection | Incident process, endpoint protection, email security, monitoring records | Application audit/security code | Incident register, endpoint/MDM evidence, SPF/DKIM/DMARC evidence, monitoring evidence | Technical Lead | Open |
| 7 Continuity | BCP/DR plan, annual exercise, backup and restore proof | Backup/restore scripts with checksum validation | Encrypted off-platform backup job, timed restore exercise, action log | Technical Lead | Open |
| 8 Supported systems | Asset/configuration record, patch process and vulnerability reporting | Dependency tests and application release process | Hardware/software register, patch reports, NCSC Early Warning record | Technical Lead | Open |
| 9 IT protection | Penetration test, secure configuration, encryption, change records, firewall evidence | TLS, encrypted MFA secret, secure mobile storage, code tests | Independent penetration test, remediation plan, DNS/firewall/device evidence | Technical Lead | Open |
| 10 Suppliers | Supplier register, DPAs/contracts, shared-responsibility record | Deployment and integration architecture | Current supplier inventory, signed DPA/contract terms, assurance records | Director / Procurement | Open |

## Technical evidence already available in the repository

- `GATE-C-SECURITY-PRIVACY.md`: implemented application controls and external release blockers.
- `MOBILE-PRODUCTION-AUDIT.md`: mobile security and release checks.
- `AniProTech_Node_Backend/src/services/security.js` and `src/security-schema.js`: session, MFA, privacy, retention and audit control implementation.
- `AniProTech_Node_Backend/scripts/backup.js`: backup tooling.
- Backend automated tests for security and audit functionality.

## Mandatory external actions before submission

1. Obtain the ICO registration number and publish an approved privacy notice.
2. Approve governance appointments, policies, data inventory, risk register and DPIA process.
3. Enforce MFA for privileged and remotely accessible accounts and retain an adoption report.
4. Configure encrypted off-platform backups, perform a timed restore drill, and retain its result.
5. Run an independent penetration test and close or formally risk-accept material findings.
6. Run and record an incident-response and business-continuity exercise.
7. Complete staff information-governance and cyber-security training and retain completion evidence.
8. Create and maintain a supplier register, contracts/DPAs and shared-responsibility record.
9. Have the SIRO and authorised director review the evidence before any DSPT declaration or publication.
