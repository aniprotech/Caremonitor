# Caremonitor documented security controls

**Product:** Caremonitor  
**Supplier:** ANIKA IT SOLUTIONS LIMITED (ODS: W4L8U)  
**Document owner:** Information Governance Lead / SIRO  
**Issue date:** 12 October 2026  
**Approved date:** To be completed by the SIRO or authorised director  
**Next review date:** 12 October 2027  
**Status:** Draft — operational evidence and leadership approval required before DSPT attestation  
**Review cycle:** At least annually, and after a material service, security, supplier or regulatory change

## 1. Purpose and scope

This document describes the controls used to protect the confidentiality, integrity and availability of the Caremonitor web and mobile care-management service throughout design, development, deployment, support and retirement.

Caremonitor processes health and care information for authorised care-provider organisations. It covers the production web application, caregiver mobile applications, backend APIs, database, document uploads, scheduled jobs, integrations, source code and administrator/support access.

## 2. Control objectives

Caremonitor is operated to:

- permit access only to authorised people for a legitimate role and care purpose;
- keep customer information accurate, available and recoverable;
- prevent unauthorised disclosure, alteration, deletion and service interruption;
- detect, investigate and respond to security events promptly;
- maintain evidence of security decisions, changes and access; and
- manage security risk across suppliers and integrations.

## 3. Security controls

| Area | Control | Current implementation or required operating control | Evidence retained |
| --- | --- | --- | --- |
| Governance | Named ownership | The SIRO, information governance lead, privacy lead and technical service owner have documented responsibilities. | Appointment record, governance meeting minutes, risk register. |
| Risk management | Risk-based operation | A data-security risk register records owner, likelihood, impact, treatment, target date and review date. Risks from suppliers, NHS integrations and clinical data are included. | Current risk register and management review. |
| Secure development | Change control | Code changes are reviewed, tested and traceable in source control before release. Security-impacting changes require documented review. | Pull requests, test results, release records. |
| Secure design | Privacy and security by design | New processing, integrations and features are assessed for data protection and security impact before production release. High-risk processing triggers a DPIA. | DPIA register, design review, approvals. |
| Identity | Individual accounts | Users authenticate with individual accounts; shared accounts are prohibited for normal use. Sessions are attributable to a person and device. | User register, session/audit logs, access review. |
| MFA | Strong authentication | Administrator MFA is available through TOTP. MFA must be enforced for privileged, remotely accessible and production-support accounts before DSPT attestation. | MFA configuration, adoption report, exception approvals. |
| Authorisation | Least privilege and tenant isolation | Access is role-based and agency-scoped. Data queries must enforce tenant scope, and privileged actions require recent authentication. | Role matrix, automated tests, quarterly access reviews. |
| Auditability | Security and care audit trail | Caremonitor records relevant user, privacy and operational events. Audit records are protected, retained according to policy and reviewed. | Audit-log retention setting, review records, investigation samples. |
| Encryption | Data in transit and secrets | Production services use TLS. Credentials and keys are stored in protected environment configuration; MFA secrets use AES-256-GCM encryption. | TLS configuration, secrets register, key-rotation records. |
| Data minimisation | Controlled collection and retention | The service stores only data required for care operations. Retention periods, correction, export, erasure and legal-hold decisions are managed at tenant level. | Retention schedule, privacy request register, legal-hold register. |
| Backups and recovery | Recoverable service | PostgreSQL and uploads are backed up with checksum manifests. Backups must be encrypted, separated from production and subject to a documented, timed staging restore drill. | Backup schedule, encrypted storage configuration, restore-test record. |
| Vulnerability management | Patch and remediation process | Supported dependencies and platforms are maintained. Vulnerabilities are triaged by severity, recorded, remediated to agreed targets and verified before closure. Critical and high-risk issues are prioritised. | Vulnerability register, dependency reports, remediation evidence. |
| Monitoring | Detect and investigate | Production infrastructure and application logs are collected, protected, searchable and reviewed. Alerting and an escalation route must cover suspicious authentication, availability and data-access events. | Monitoring configuration, alert reviews, incident tickets. |
| Incident response | Tested response | Security incidents and near misses are recorded, triaged, contained, investigated, communicated and reviewed. Material incidents are escalated to leadership and customers as required. | Incident plan, incident register, exercise report. |
| Continuity | Essential-service resilience | The service has a continuity and disaster-recovery plan covering loss of database, deployment platform, credentials, files, integration and staff availability. It is tested at least annually. | BCP/DR plan, test report, action log. |
| Supplier assurance | Managed third parties | Suppliers that process data or support essential service delivery are listed, risk-assessed and bound by appropriate contractual terms. Shared-responsibility boundaries are documented. | Supplier register, DPAs, contracts, assurance reviews. |
| Mobile security | Protected caregiver app | Mobile tokens are held in platform secure storage; clear-text production traffic is disabled; offline changes are encrypted and synchronised when connectivity returns. | Mobile security review, signed-build testing, device test record. |
| Secure disposal | Safe retirement | Accounts, integrations, keys, data and media are disabled or securely disposed of under the retention schedule and legal-hold process. | Offboarding checklist, erasure and revocation records. |

## 4. Operational minimum before claiming DSPT compliance

The following must be in place and evidenced, not merely planned:

1. Enforced MFA for all administrator, production-support and remotely accessible accounts.
2. Encrypted, off-production backups and a successful documented restoration exercise.
3. A current asset inventory, supplier register, access review and risk register.
4. A tested incident-response and business-continuity exercise with named actions.
5. Vulnerability scanning, patching evidence and an independent penetration test with remediation tracking.
6. Published privacy information, data-subject-rights process, retention schedule and DPIA process.
7. Written supplier agreements and clear shared-responsibility records for hosting, email, authentication and other processors.
8. Evidence that Caremonitor follows the government Software Security Code of Practice and that material findings are tracked to closure.

## 5. Assurance and review

The technical lead reviews this document quarterly. The SIRO and information-governance lead review it at least annually, after a material incident, and before any DSPT submission. Evidence is retained in the compliance repository with document owner, date, version and approval status.

No one may use this document alone as evidence that all controls are operating effectively. DSPT responses must be based on current, verifiable evidence and approved by the authorised organisational officer.

## 6. References

- [NHS Cyber Security Charter for Suppliers](https://digital.nhs.uk/cyber-and-data-security/guidance-and-resources/cyber-security-charter-for-suppliers-to-the-nhs)
- [NCSC 10 Steps to Cyber Security](https://www.ncsc.gov.uk/collection/10-steps)
- [NCSC vulnerability management guidance](https://www.ncsc.gov.uk/collection/10-steps/vulnerability-management)
- [NCSC data-security guidance](https://www.ncsc.gov.uk/collection/10-steps/data-security)
