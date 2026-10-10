# Security Policy

## Supported versions

FreqHub is in early development (alpha). Security fixes target the latest code on `main` / `develop`. Older tagged releases may not receive backports.

| Version | Supported |
|---------|-----------|
| `main` / latest release | ✅ |
| Older tags | ❌ Best-effort only |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Prefer one of:

1. **[Private vulnerability reporting](https://github.com/hrodrig/freqhub/security/advisories/new)** on this repository (recommended).
2. Email maintainers: **hrodrig@usb.ve** (same contact as [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)).

Please include:

- Description of the issue and impact
- Steps to reproduce or a proof of concept (if safe)
- Affected component (`backend`, `frontend`, `config-service`, `config-agent`, Docker, etc.)
- FreqHub version / commit if known

## What to expect

- Acknowledgement when practical (often within a few days)
- Assessment and, if confirmed, a fix or advisory
- Credit in the advisory or CHANGELOG if you want it (say so in the report)

## Scope notes

FreqHub talks to Freqtrade bots and may hold API credentials. Reports involving auth bypass, SSRF, privilege escalation, secret exposure, or unsafe dependency use are especially welcome. Issues that only affect misconfigured self-hosted deployments may be treated as hardening guidance rather than CVEs.

## Safe harbor

We appreciate good-faith research. Avoid destructive testing against systems you do not operate, and do not access other users’ data.
