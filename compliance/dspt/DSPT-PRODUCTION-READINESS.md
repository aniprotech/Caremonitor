# Caremonitor DSPT production security readiness

**Product:** Caremonitor  
**Supplier:** ANIKA IT SOLUTIONS LIMITED (ODS: W4L8U)  
**Issue date:** 12 October 2026  
**Owner:** Information Governance Lead / SIRO  
**Status:** Readiness assessment — do not use this document as an attestation  
**Next review:** Before production release and at least annually

## What has been checked in the Caremonitor source

| Control area | Current result | Evidence |
|---|---|---|
| Tenant separation and permissions | Implemented and tested | API integration tests cover agency, client and caregiver boundaries. |
| Authentication and sessions | Implemented and tested | Single-use email links, revoked-session handling and inactive-account blocks are covered by automated tests. |
| MFA and device sessions | Implemented and tested | TOTP MFA, session visibility and session revocation are implemented and covered by tests. |
| Data protection workflows | Implemented and tested | Retention, subject-access export, correction, erasure and legal-hold controls are implemented and tested. |
| Clinical and medication integration safeguards | Implemented and tested | NHS tokens remain server-side; unavailable credentials return an explicit configuration state rather than an empty clinical result. |
| Mobile safeguards | Implemented and tested | Assigned visit access, location alerts and privacy-safe notification content are covered by automated tests. |
| Production configuration guardrails | Implemented | Production startup rejects a missing or short JWT secret, a non-PostgreSQL database and a non-HTTPS frontend URL. |
| Dependency vulnerabilities | Cleared on 12 October 2026 | `npm audit --omit=dev --audit-level=high` returned zero vulnerabilities after updating `ip-address`, `multer` and `proxy-addr`. |
| Automated regression suite | Passed on 12 October 2026 | `npm test`: 126 passed, 0 failed. |

## Required before a DSPT security-controls declaration

| Action | Accountable owner | Evidence required |
|---|---|---|
| Approve the security-controls policy and this readiness assessment | SIRO or authorised director | Signed approval or board/management record. |
| Enforce MFA for privileged, remote and production-support accounts | Technical service owner | Configuration export and adoption report; approved exceptions only. |
| Confirm Railway production variables and HTTPS routing | Technical service owner | Redacted configuration review showing PostgreSQL, strong JWT and MFA encryption keys, HTTPS URLs, trusted proxy and approved mail configuration. |
| Confirm uploads and database use durable, encrypted production storage | Technical service owner | Railway storage architecture, encryption statement and access restrictions. |
| Implement encrypted off-platform backups and test restore | Technical service owner | Backup schedule, retention settings and dated successful restore record. |
| Configure security monitoring and alert response | Technical service owner | Log/alert configuration, on-call route and sample reviewed alert. |
| Run an independent vulnerability assessment or penetration test | SIRO / technical service owner | Scope, dated report, remediation record and accepted residual risks. |
| Exercise the incident, continuity and recovery plan | SIRO / service owner | Dated exercise record, actions and closure evidence. |
| Maintain asset, supplier and risk registers | IG lead / service owner | Current registers with review dates and assigned risk owners. |
| Review staff screening, training and access removal processes | Operations lead | Training matrix, leaver checklist and access review record. |

## Release decision

The codebase is ready for a controlled production deployment only after the operational controls above are verified. The SIRO or authorised director must make the final DSPT declaration based on this evidence and the live operational environment.
