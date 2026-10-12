# Caremonitor incident, continuity and recovery plan

| Document control | Value |
| --- | --- |
| Organisation | ANIKA IT SOLUTIONS LIMITED |
| Service | Caremonitor |
| Owner | Technical Lead |
| Approver | SIRO |
| Issue date | 12 October 2026 |
| Approved date | To be completed by the SIRO |
| Next review date | 12 October 2027 |
| Status | Draft for exercise and approval |

## 1. Activation

Activate this plan for suspected unauthorised access, loss or corruption of personal data, ransomware, malware, unavailable production service, compromised credentials, failed backup/restore, material supplier outage or an NHS-integration security event.

The person discovering the issue must record the time, affected service, reporter and immediate symptoms, then notify the Technical Lead and SIRO. Do not delete evidence, restart affected systems unnecessarily or communicate externally until an incident lead is appointed.

## 2. Roles

| Role | Responsibility |
| --- | --- |
| Incident Lead | Coordinates containment, decision log, communications and recovery. |
| Technical Lead | Assesses technical impact, preserves logs, contains threat and restores services. |
| SIRO | Owns information risk, approves material risk decisions and receives updates. |
| Information Governance / Privacy Lead | Assesses personal-data impact, notification duties and affected-person communications. |
| Director | Approves major communications, customer notification and business decisions. |

Record the named persons and contact details offline in the approved emergency contact record.

## 3. First 60 minutes

1. Open an incident record and appoint an Incident Lead.
2. Preserve relevant logs, audit records, timestamps and screenshots.
3. Contain: revoke compromised sessions/keys, disable affected accounts, isolate affected components and stop unsafe jobs.
4. Assess: affected tenants, records, integrations, data types, availability and evidence of exfiltration.
5. Notify the SIRO and Director of known facts, unknowns and next update time.
6. Decide whether to engage hosting, identity, email, NHS or security suppliers.

## 4. Communication and reporting

The Incident Lead maintains a chronological decision log. The Privacy Lead assesses whether the event is a personal-data breach and whether regulatory, customer or affected-person notification is required. Notifications must be accurate, timely and approved by the authorised officer.

## 5. Recovery

Recovery must use an approved change record. Before service restoration:

- remove the cause or apply a documented compensating control;
- rotate compromised secrets, tokens and credentials;
- validate tenant access boundaries and critical workflows;
- restore only from known-good encrypted backups where needed;
- validate restored data using agreed samples and record the outcome; and
- obtain Incident Lead approval before reopening service.

## 6. Business continuity

Maintain an approved continuity procedure for service unavailability. It must include manual-care fallback, customer communications, staff contacts, critical supplier contacts, recovery priorities, recovery-time target, recovery-point target and escalation path.

## 7. Test schedule

Run at least one documented tabletop incident exercise and one backup restoration drill annually, plus after a material change. Record participants, scenario, timings, outcomes, gaps, actions, owners and due dates. The SIRO reviews completion.
