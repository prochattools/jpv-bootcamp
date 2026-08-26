# Security Documentation Cleanup — 2026-07-29

## Summary

A worker credential used by the Payload email queue was copied into transient operational output and documentation during staging diagnostics. The repository documentation has been updated to reference the environment variable placeholder `$EMAIL_QUEUE_WORKER_SECRET` instead of a literal value.

## User decision

The repository owner explicitly decided not to rotate `EMAIL_QUEUE_WORKER_SECRET` as part of this task. Design work and release hardening must not be blocked on rotation.

## Completed safeguards

- No literal worker credential is intentionally retained in tracked or untracked documentation.
- Dokploy and email-queue guides use `$EMAIL_QUEUE_WORKER_SECRET` placeholders.
- Commands in documentation resolve the credential from the application environment rather than embedding it.
- Generated logs, screenshots, traces, backups, and worktrees remain excluded from commits.

## Remaining hardening

- Keep repository secret scanning in the changed-path validation workflow.
- Never paste environment values into documentation, test fixtures, screenshots, commands, or handoffs.
- Treat credential rotation as an explicit operator decision rather than an automatic repository change.

## Verification

Before committing documentation, run the repository security scan and confirm there are no literal credentials in tracked source or documentation. Do not print matching secret values in reports.
