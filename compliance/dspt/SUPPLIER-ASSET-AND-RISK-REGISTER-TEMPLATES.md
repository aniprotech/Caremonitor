# Caremonitor supplier, asset and risk register templates

These registers are templates. Populate them from verified contracts, invoices, configurations and technical evidence; review at least quarterly and after material changes.

**Issue date:** 12 October 2026  
**Approved date:** To be completed by the SIRO or authorised director  
**Next quarterly review:** 12 January 2027  
**Annual review date:** 12 October 2027

## Supplier register

| Supplier | Service | Personal data processed or access | Contract/DPA reference | Contract end | Security assurance | Service owner | Shared responsibility | Review date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Railway | Application hosting | Confirm from contract and configuration | Add reference | Add date | Add evidence | Technical Lead | Platform security vs Caremonitor configuration | Add date |
| Expo | Mobile build/distribution | Confirm from contract and configuration | Add reference | Add date | Add evidence | Technical Lead | Build tooling vs application code | Add date |
| Email provider | Business email | Confirm from contract and configuration | Add reference | Add date | Add evidence | Director | Email identity, spam controls, retention | Add date |

## Asset and data-flow register

| Asset or data store | Owner | Data classification | Location | Access roles | Backup/retention | Security configuration | Review date |
| --- | --- | --- | --- | --- | --- | --- |
| Caremonitor production database | Technical Lead | Health and care personal data | Confirm hosting region | Approved application/admin roles | Approved retention schedule | TLS, access control, backup evidence | Add date |
| Caremonitor file storage | Technical Lead | Client documents | Confirm location | Approved application/admin roles | Approved retention schedule | Private access and signed downloads | Add date |
| Source-code repository | Technical Lead | Confidential source and configuration | Confirm provider | Named developers | Repository retention policy | MFA, code review, branch protections | Add date |

## Data-security risk register

| ID | Risk | Likelihood | Impact | Existing controls | Action | Owner | Target date | Review date | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | Production data loss or corruption | Add rating | Add rating | Backup tooling and checksum validation | Configure encrypted off-platform backup and run restore drill | Technical Lead | Add date | Add date | Open |
| R-002 | Unauthorised privileged access | Add rating | Add rating | Individual accounts, sessions, audit logs, MFA capability | Enforce MFA and complete access review | Technical Lead | Add date | Add date | Open |
| R-003 | Exploitation of an application vulnerability | Add rating | Add rating | Code tests and release review | Penetration test, vulnerability scan and remediation tracking | Technical Lead | Add date | Add date | Open |
| R-004 | Supplier outage or compromise | Add rating | Add rating | Supplier register and service architecture | Complete supplier due diligence and continuity plan | Director | Add date | Add date | Open |
