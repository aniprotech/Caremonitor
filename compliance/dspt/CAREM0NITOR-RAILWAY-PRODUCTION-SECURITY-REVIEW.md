# Caremonitor Railway production security review

**Service reviewed:** Caremonitor backend (`backend.aniprotech.com`)  
**Review date:** 13 October 2026  
**Reviewer:** Technical Service Owner / Codex-assisted review  
**Evidence source:** Railway production service configuration viewed in the authorised Railway account  
**Status:** Review only — no live settings changed

## Confirmed from the live Railway configuration

| Area | Observation | Status |
|---|---|---|
| Service availability | Backend service was online at review time. | Confirmed |
| Source deployment | GitHub repository `aniprotech/Caremonitor`, branch `main`, backend root directory configured. | Confirmed |
| Database/secrets variables | Variables for PostgreSQL connection, JWT secret, MFA key, Gmail, NHS signing keys and Salt Edge were present but not viewed or copied. | Confirmed without exposing secret values |
| Custom endpoint | `backend.aniprotech.com` is configured. | Confirmed |
| Deployment region | Service is configured in US West (California, USA). | Requires UK/EU data-residency review |
| Public endpoint | Railway-generated `birdie-backend.up.railway.app` endpoint remains exposed in addition to the custom domain. | Review and retire after confirming no dependency |
| Deployment gate | Auto-deploy from `main` is enabled; “Wait for CI” is off. A GitHub Actions workflow has now been prepared locally, but is not yet pushed to GitHub. | Enable only after the workflow runs successfully on GitHub |
| Health check | No Railway deployment health-check path is configured. The application exposes `/api/health` and checks database connectivity. | Configure `/api/health` and test a controlled deploy |
| Replica count | One replica. | Record accepted availability risk / recovery target |
| Persistent upload storage | No attached-volume evidence was confirmed during this review. | Confirm upload/data durability design before declaration |

## Required actions

1. **Data residency:** obtain written confirmation that the hosting location and subprocessor arrangement meet customer contracts, UK GDPR and NHS requirements. If not, move to an approved UK/EU location before health/care data is processed.
2. **Deployment safety:** enable Railway’s “Wait for CI” only after GitHub Actions is configured to run the backend test suite and frontend production build for every `main` change.
3. **Health check:** configure the already-tested backend health endpoint as Railway’s deployment health-check path, then verify a controlled deploy passes it.
4. **Public domains:** confirm whether the Railway-generated domain is needed. If it is not required, remove it after testing the custom domain and client/mobile callback configuration.
5. **Storage and backups:** document uploads and database storage, encryption, backup frequency, retention, off-platform copy and successful restore result. Do not rely on a container filesystem for durable uploads.
6. **Secrets:** keep secrets hidden in Railway; maintain a secret owner, rotation date, revocation route and access review. Do not paste production secrets into DSPT evidence.
7. **Monitoring:** configure availability, error-rate, authentication-failure and backup-failure alerts with named responders and a test alert record.
8. **Access review:** export or record the authorised Railway users, their roles, MFA status and last review date.

## Release decision

The automated software checks pass, but production assurance is not complete until the listed Railway, backup, monitoring, residency and access-review evidence is verified and approved by the SIRO/DPO and technical owner.
