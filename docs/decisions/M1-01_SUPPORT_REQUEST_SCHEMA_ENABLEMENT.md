# M1-01 — Dedicated Support-Request Schema Enablement Decision

- **Status:** Approved
- **Approved by:** Authorized JPV Bootcamp business owner
- **Approval date:** 12 July 2026
- **Related packet:** M1-01 schema enablement
- **Related controls:** H0-04 and H1-03

## Decision summary

A dedicated durable support-request model is approved as the required schema foundation for M1-01.

The schema-enablement packet may add the smallest additive model and unapplied migration necessary to represent support intake without reusing or corrupting sponsored-application, CRM contact, contact-note, email-event, or admin-notification domain records.

## Approved fields

The dedicated model may include:

- immutable request ID;
- normalized email;
- name;
- question or message;
- optional source;
- optional page;
- unique dedupe key;
- explicit review status;
- notification delivery status;
- notification retry metadata;
- created and updated timestamps;
- reviewed timestamp and reviewer identifier where appropriate.

## Packet boundaries

The schema-enablement packet must:

- use existing Prisma and repository naming conventions;
- add only additive schema and migration changes;
- include rollback notes;
- include focused schema and migration safety tests;
- leave the migration unapplied;
- keep `/api/support` guarded, preview-only, and non-operational;
- add no support runtime workflow, queueing, review actions, or access behavior;
- change no provider, deployment, Stripe, email-provider, Payload, or database configuration;
- commit only schema, migration, and directly focused tests.

## Explicit exclusions

This approval does not authorize:

- applying the migration;
- beginning the M1-01 runtime workflow;
- granting access from support submissions;
- reusing sponsored-application records for support;
- modifying public-route behavior;
- beginning M1-02, M2-01, or unrelated feature work.

## Runtime continuation gate

The M1-01 runtime packet may resume only after this schema-enablement packet is implemented, validated, committed, and the migration remains intentionally unapplied pending the normal release migration process.
