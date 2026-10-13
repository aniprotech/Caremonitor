# Caremonitor monitoring, alerting and assurance exercise plan

| Document control | Value |
| --- | --- |
| Organisation | ANIKA IT SOLUTIONS LIMITED |
| Service | Caremonitor |
| Owner | Technical Service Owner |
| Approver | SIRO / IG Lead |
| Issue date | 13 October 2026 |
| Next review date | 13 April 2027 |
| Status | Draft — configuration and evidence required |

## 1. Purpose

This plan turns the Caremonitor incident, continuity and recovery plan into operational evidence. It is not proof that monitoring, backup recovery, penetration testing or incident exercises have already occurred. Named owners must configure, test and retain the evidence below before answering DSPT assertions that require it.

## 2. Minimum production monitoring

| Control | What must be monitored | Trigger | Primary owner | Evidence to retain |
| --- | --- | --- | --- | --- |
| Availability | `GET /api/health` on `https://backend.aniprotech.com` | Non-200 response or two consecutive failures | Technical Service Owner | Alert configuration and a test-alert record |
| Application errors | Railway deployment and runtime error logs | Sustained errors, restart loops, or failed deployment | Technical Service Owner | Log review record and incident/action reference |
| Authentication | Failed login, locked / rate-limited attempts, administrator sign-in anomalies | Repeated failures or unexpected administrator activity | Security Lead | Audit-log review record and response evidence |
| Database | Database connection failure and backup job failure | Failed connection, missing backup or failed backup | Technical Service Owner | Backup log, manifest and escalation record |
| Queue/email | Email delivery errors and notification worker failures | Repeated delivery failure or queue growth | Technical Service Owner | Error review record and remediation ticket |
| NHS integrations | ODS/dm+d token or API failure and unexpected volume | Failed auth, repeated timeout or error-rate threshold | Integration Owner | Provider status check, error extracts and response ticket |
| Vulnerability exposure | Dependency scan and supported-runtime status | High/critical advisory or unsupported component | Technical Service Owner | Scan output, prioritised remediation log |

Alerts must go to a named mailbox or on-call channel owned by the organisation. Do not configure them to an individual’s personal account without an approved support and leaver process.

## 3. Railway actions and test record

The following actions are ready to be performed by an authorised Railway administrator after the GitHub CI workflow is pushed and observed on GitHub:

1. Set Railway deployment **Wait for CI** to enabled only after `Caremonitor CI` has succeeded on the `main` branch.
2. Set the deployment health-check path to `/api/health`.
3. Run one controlled deployment.
4. Record deployment identifier, time, health-check result, the responder, and whether `https://backend.aniprotech.com/api/health` returned HTTP 200.
5. Confirm whether the generated Railway public domain is necessary; retire it only after mobile and external callback checks pass.

| Field | Completion record |
| --- | --- |
| Date/time | To be completed |
| Railway administrator | To be completed |
| Deployment identifier | To be completed |
| CI run URL/result | To be completed |
| Health-check result | To be completed |
| Custom-domain test | To be completed |
| Follow-up actions | To be completed |

## 4. Backup and restore evidence

Caremonitor provides `npm run backup` and `npm run restore:drill` scripts. The backup script creates a PostgreSQL custom-format backup, records a SHA-256 checksum in `manifest.json`, and copies the configured upload directory if one exists. The restore drill rejects a source-database target and verifies the checksum before invoking `pg_restore`.

Before any live claim can be made, the technical owner must:

1. configure encrypted backup storage separate from the running service;
2. define frequency, retention, access permissions and offboarding/rotation process;
3. run `npm run backup` with the production-approved configuration;
4. restore one backup to a separate non-production database using `npm run restore:drill`;
5. validate a sample of clients, visits, attachments and tenant boundaries; and
6. record the test below, including any remedial actions.

| Field | Completion record |
| --- | --- |
| Backup date/time and location reference | To be completed — do not record secrets or storage URLs here |
| Backup operator | To be completed |
| Restore-drill date/time | To be completed |
| Isolated target confirmed | To be completed |
| Checksum verified | To be completed |
| Data-validation result | To be completed |
| Recovery time achieved | To be completed |
| Recovery-point evidence | To be completed |
| SIRO review | To be completed |

## 5. Tabletop incident exercise

Run this exercise before relying on the plan.

**Scenario:** A privileged Railway/GitHub credential is suspected compromised after unusual administrator activity and failed sign-ins are detected. Assume potential access to Caremonitor configuration and personal data until assessed.

| Stage | Expected action | Evidence |
| --- | --- | --- |
| Detect | Capture alert/log time and open an incident record. | Timestamped incident record |
| Contain | Revoke sessions/keys, restrict access and preserve logs. | Decision log and access-change record |
| Assess | Identify affected tenants, data classes, systems, suppliers and uncertainty. | Impact assessment |
| Notify | SIRO/IG lead assesses notification needs and timescales. | Approved communications decision |
| Recover | Confirm corrected access, rotate credentials, verify critical routes and close only with approval. | Recovery checklist |
| Learn | Record gaps, owners, deadlines and retest date. | Corrective-action log |

| Field | Completion record |
| --- | --- |
| Exercise date and duration | To be completed |
| Participants and roles | To be completed |
| Incident lead | To be completed |
| Findings | To be completed |
| Actions, owners and due dates | To be completed |
| SIRO sign-off | To be completed |

## 6. Vulnerability assessment and remediation

Before production assurance, run an authenticated and unauthenticated vulnerability assessment against the approved production scope, supplemented by dependency checks. An independent penetration test should be commissioned when risk assessment, contracts or DSPT expectations require it. Scope, tester, rules of engagement, findings, risk acceptance, remediation owner and retest evidence must be recorded.

| Finding reference | Severity | Owner | Target date | Status | Retest evidence |
| --- | --- | --- | --- | --- | --- |
| To be completed | To be completed | To be completed | To be completed | Open | To be completed |

## 7. Evidence ownership

Store final evidence in a restricted organisation-controlled location. The SIRO, IG Lead and DPO must approve the records relevant to their responsibilities. This plan should be reviewed after a material infrastructure change, security incident, failed exercise or at least every six months.
