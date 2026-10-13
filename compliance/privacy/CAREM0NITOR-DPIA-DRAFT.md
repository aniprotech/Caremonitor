# Caremonitor data protection impact assessment — draft

**Supplier:** ANIKA IT SOLUTIONS LIMITED (ODS: W4L8U)  
**Service:** Caremonitor  
**Issue date:** 12 October 2026  
**Status:** Draft — DPO review and customer-controller input required  
**Review trigger:** New NHS integration, AI capability, sensitive-data use, sharing model or material security change

## Processing described

Caremonitor is a web and mobile care-management service. It supports care-provider organisations to maintain client identity, care plans, clinical and medication information, visits, staff training and recruitment records, finance workflows, documents, audit records and authorised sharing.

## People and data affected

Data subjects can include care clients, relatives/authorised contacts, care workers, administrators, job applicants, referrers and professionals. Data can include health information, medication, allergies, care needs, risks, safeguarding concerns, identity/contact details, visit location/timing, employment information, documents, bank/payment administration data and security logs.

## Necessity and proportionality

Caremonitor is designed for direct-care and care-management processes. Customer organisations configure the fields, roles, retention and sharing decisions needed for their services. Access is intended to be restricted by organisation, role, care-team assignment and explicit sharing choices. Customer controllers must document their lawful basis and special-category condition for each use.

## Principal risks and required controls

| Risk | Required control | Residual-risk decision |
|---|---|---|
| Unauthorised cross-organisation access | Tenant scoping, role checks, automated tests, access reviews | Technical owner and DPO to verify before live use. |
| Inappropriate staff access | Individual accounts, MFA, session records, least privilege and leaver process | Operations and technical owners to provide evidence. |
| Loss of health/care data | Encrypted transport, protected secrets, durable encrypted backups and restore drills | Requires live Railway/storage evidence. |
| Unsafe care decision from inaccurate data | Review/approval workflows, audit trail, user training and human clinical judgement | Customer care provider owns clinical governance. |
| Unauthorised sharing with family/contacts | Explicit recipient, section and consent controls; expiry/revocation | Customer verifies each sharing decision. |
| Data subject rights not fulfilled | Request log, export/correction/erasure workflow and legal holds | DPO verifies process and deadlines. |
| Supplier failure or compromise | Due diligence, DPA, monitoring, exit/continuity plan | Supplier register and contracts required. |
| NHS/API integration misuse | Approved NHS access, server-side credentials, documented purpose and testing | Enable only after NHS approval and DPIA update. |

## Required decisions before approval

1. Name the controller(s), processor(s), DPO and incident contacts.
2. Confirm lawful bases, special-category conditions and care-provider responsibilities.
3. Complete data-flow map and supplier register.
4. Verify the live hosting, backup, monitoring and access-control evidence.
5. Record customer-controller consultation where required.
6. DPO approves, rejects or escalates the residual risk before production use.
