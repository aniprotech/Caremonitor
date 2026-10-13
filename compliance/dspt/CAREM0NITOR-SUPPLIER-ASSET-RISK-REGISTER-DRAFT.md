# Caremonitor supplier, asset and risk register — draft

**Supplier:** ANIKA IT SOLUTIONS LIMITED (ODS: W4L8U)  
**Service:** Caremonitor  
**Issue date:** 12 October 2026  
**Owner:** Information Governance Lead and Technical Service Owner  
**Status:** Draft populated from source architecture — validate live contracts, data locations and service accounts before approval  
**Next review:** 12 January 2027, and after any supplier or material service change

## Supplier register

| Supplier/service | Use in Caremonitor | Data / service criticality | Data-processing role | Required evidence | Owner | Status |
|---|---|---|---|---|---|---|
| Railway | Production application hosting, runtime configuration and PostgreSQL connection | Critical; may host health/care data and service credentials | Processor/subprocessor to confirm | Contract/DPA, region, encryption, access/MFA, backup and exit evidence | Technical Service Owner | Verify before approval |
| GitHub | Source code, change review and deployment source | Critical for integrity and recovery; must not hold production data or secrets | Supplier to confirm | Organisation account, MFA, repository access review, secret scanning and recovery evidence | Technical Service Owner | Verify before approval |
| Expo / EAS | Android and iOS application build and distribution | Important; build credentials and release artefacts | Supplier to confirm | Account ownership, MFA, build-credential protection and deletion/exit evidence | Mobile Service Owner | Verify before approval |
| Google Workspace / Gmail API | Transactional sign-in and notification email | Important; user email addresses and message metadata | Processor/subprocessor to confirm | DPA, account MFA, mail authentication and retention evidence | Technical Service Owner | Verify before approval |
| NHS API Platform / ODS | Organisation-directory integration and NHS developer onboarding | Important; access credentials and query/audit metadata | NHS service terms apply | Approved application, credential register, scope/purpose and access review | NHS Integration Owner | In progress |
| NHSBSA TRUD dm+d | Licensed medicine reference-data download | Important to clinical terminology accuracy | Data supplier; personal data not expected in reference files | Current licence, release version, import record and update schedule | Clinical Product Owner | Partly evidenced |
| Salt Edge | Optional consented banking/account-information integration | High if enabled; financial data | Processor/subprocessor to confirm | Contract, DPA, customer consent flow, key rotation and disablement evidence | Finance Product Owner | Do not enable until verified |
| Apple / Google developer services | Mobile application signing and store distribution | Important; signing keys and app metadata | Supplier to confirm | Organisation account, MFA, release approval and signing-key controls | Mobile Service Owner | Verify before approval |
| Domain / DNS provider | Caremonitor and backend domain resolution | Critical availability/security service | Supplier to confirm | Account MFA, registrar lock, DNS change log and recovery contact | Technical Service Owner | Supplier name to confirm |

## Asset register

| Asset | Owner | Classification | Location / environment | Key control | Review status |
|---|---|---|---|---|---|
| Caremonitor web application | Technical Service Owner | Confidential service | Railway production / browser | HTTPS, authenticated role access, secure release process | Verify live deployment |
| Caremonitor backend API | Technical Service Owner | Confidential / critical | Railway production | PostgreSQL-only production guardrail, secrets, audit trail and tenant isolation | Verify live configuration |
| PostgreSQL care data | Technical Service Owner | Special-category health/care data | Railway PostgreSQL — location to confirm | Encrypted backups, restricted access and restore tests | Open evidence required |
| Document uploads | Technical Service Owner | Confidential / special-category possible | Storage location to confirm | Private access, retention and encrypted backup | Open evidence required |
| Android/iOS caregiver applications | Mobile Service Owner | Confidential application | Expo/EAS and app stores | Secure storage, signed builds and release controls | Verify live release setup |
| GitHub source repositories | Technical Service Owner | Confidential / critical integrity | GitHub organisation | MFA, least privilege, protected main branch and secret scanning | Open access review |
| NHS integration credentials | NHS Integration Owner | Secret / critical | Railway protected variables | Server-side only, rotation and access register | Live access pending |
| Email credentials | Technical Service Owner | Secret / important | Railway protected variables | Dedicated sender, MFA and rotation record | Verify live configuration |
| Staff/admin devices | Operations Lead | Confidential endpoint | Organisation managed devices | Full-disk encryption, patching, screen lock and leaver process | Device inventory required |

## Initial risk register

| Risk | Likelihood | Impact | Required treatment | Owner | Target review | Status |
|---|---|---|---|---|---|---|
| Production data unavailable after hosting or database failure | Medium | High | Encrypted off-platform backups, restore runbook and timed restoration exercise | Technical Service Owner | Before production declaration | Open |
| Privileged account compromised | Medium | High | Enforce MFA, least privilege, session review and rapid revocation | Technical Service Owner | Before production declaration | Open |
| Sensitive data accessed by an unauthorised user | Low | High | Access reviews, training, audit monitoring and incident response | IG Lead / Technical Service Owner | Quarterly | Open |
| Supplier outage or security incident | Medium | High | Contract/DPA review, exit plan, monitoring and continuity exercise | Director / Technical Service Owner | Before production declaration | Open |
| Incorrect medication or care data used in care | Medium | High | Human review, approved care-plan workflow, terminology provenance and clinical governance | Clinical Product Owner | Before NHS live integration | Open |
| NHS credentials used outside approved purpose | Low | High | Server-side credentials, role restriction, access logs and NHS approval boundaries | NHS Integration Owner | Before live activation | Open |
| Mobile device lost or compromised | Medium | Medium | Device encryption, app session expiry, remote access revocation and staff training | Operations Lead | Quarterly | Open |
| Release introduces a security defect | Medium | High | Peer review, automated tests, dependency audit and controlled deployment | Technical Service Owner | Every release | Partly evidenced |

## Completion actions

1. Replace each “to confirm” item with the exact contracting entity, data location, DPA/contract reference and named owner.
2. Attach access-review, MFA, backup, restore, monitoring and penetration-test evidence.
3. Score risks using the organisation’s approved likelihood/impact method and obtain risk-owner acceptance.
4. Review this register at least quarterly and after any material supplier, data-flow or security change.
