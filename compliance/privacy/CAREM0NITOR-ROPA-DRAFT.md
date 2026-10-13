# Caremonitor record of processing activities — draft

**Supplier:** ANIKA IT SOLUTIONS LIMITED (ODS: W4L8U)  
**Issue date:** 12 October 2026  
**Status:** Draft — controller/processor roles and suppliers must be confirmed  
**Owner:** DPO / Information Governance Lead  
**Next review:** 12 October 2027 or on material change

| Processing activity | Role | Purpose | Data subjects and categories | Recipients / processors | Retention | Security measures |
|---|---|---|---|---|---|---|
| Care and client management | Processor for customer care provider | Deliver and evidence care, visits, plans, medication and safeguarding workflow | Clients; contacts; health, care, identity and visit data | Customer-authorised staff; hosting/support suppliers | Customer retention schedule and legal holds | Tenant roles, HTTPS, audit records, MFA for privileged users |
| Workforce management | Controller for own workforce; processor where customer enters workforce data | Recruitment, onboarding, training, scheduling and employment administration | Applicants, carers, employees; identity, employment, training and availability data | Authorised HR/operations users; suppliers | Employment/contract retention schedule | Least privilege, access reviews, audit records |
| Finance and accounting | Controller for own billing; processor where customer finance data is hosted | Invoicing, pay calculations, accounting contacts and payment reconciliation | Customers, staff, payees; invoice, rate and payment metadata | Authorised finance users; banking/accounting suppliers | Finance/tax retention schedule | Role separation, audit trail, secure supplier configuration |
| Authentication and security | Controller | Account access, fraud prevention, security investigation and service integrity | Users; email, role, session/device/IP and audit-event data | Authorised technical/support staff; identity/email suppliers | Security/audit retention schedule | Single-use login links, session revocation, MFA, protected secrets |
| Customer support and service administration | Controller | Contract management, support and service communications | Customer contacts; contact, contract and support records | Authorised support staff; communication suppliers | Contract/support retention schedule | Access control, audit records, supplier agreements |

## Completion checklist

- Add registered office, DPO contact and ICO registration number.
- Confirm each actual supplier, data location, international transfer and contractual safeguard.
- Insert approved retention periods.
- Confirm lawful basis and Article 9 condition with customer controllers.
- Approve and retain this register with the data-flow map.
