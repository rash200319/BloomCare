# Security

BloomCare is an **interview / portfolio clinical-workflow demo**. It is **not** certified for production PHI.

## Reporting

If you find a vulnerability in this repository:

1. Email **pabodarashmi668@gmail.com** with a short description and reproduction steps.
2. Do not open a public issue for credential leaks or exploit details until mitigated.
3. Please allow reasonable time for a fix before disclosure.

## Scope

**In scope (demo code):** auth/session handling, API authorization, frontend CSP, mobile offline queue integrity, CI secret scanning.

**Out of scope:** third-party hosts (Railway/Vercel defaults you do not control), social engineering, physical device theft without SecureStore, and claiming compliance frameworks.

## Pre–pen-test checklist

Use this before any paid assessment or serious shared deploy:

- [ ] Strong unique `SECRET_KEY` set; `BLOOMCARE_ENFORCE_SECRETS=true`
- [ ] `BLOOMCARE_DISABLE_API_DOCS=true` on shared hosts
- [ ] `BLOOMCARE_EXPOSE_DEMO_OTP` **unset/false**
- [ ] `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false` (or demo accounts rotated/removed)
- [ ] `BLOOMCARE_AUDIT_LOG_ENABLED=true` on clinical Postgres
- [ ] CORS `ALLOWED_ORIGINS` limited to real frontends
- [ ] CI **secrets** job green (gitleaks)
- [ ] SCA job reviewed (pip-audit / npm audit — currently warn-only)
- [ ] CSP headers present on the web app (`frontend/next.config.mjs`)
- [ ] Idle timeout considered (`NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES`)
- [ ] No real patient data in demo DBs or screenshots

## What a pen-test is (and is not)

A penetration test is a **time-boxed assessment by qualified people** against an agreed scope.  
CI scanners, this checklist, and control mapping docs are **preparation**, not a substitute for that assessment.

## Related docs

- [`docs/CONTROL_MAPPING.md`](docs/CONTROL_MAPPING.md) — access / audit / integrity / transmission map  
- [`README.md`](README.md) — Security & Compliance Notes  
