# Programme Content Publication Approval

- Decision ID: `programme-content-publication`
- Current status: `AWAITING_CLIENT_CONTENT`
- Decision owner role: `Client content owner`
- Approver role: `JPV Bootcamp business owner`
- Implementation owner role: `Content import operator`
- Rollback owner role: `Release rollback owner`
- Classification: `external`
- Release impact: `Blocks staging smoke signoff and formal go/no-go.`
- Depends on: `none`
- Required evidence summary: `docs/client/PROGRAMME_CONTENT_INTAKE_TEMPLATE.md`, `docs/client/PROGRAMME_CONTENT_APPROVAL_RECORD.md`, `pnpm content:programme:validate`, `pnpm content:programme:acceptance`, and `pnpm content:programme:import-plan`

## Current status

- Programme content is still blocked.
- `/portal/programme` remains preview-only.
- The repository-owned intake, validation, acceptance-report, and import-plan commands are complete and ready.

## External deliverable required

- Exact missing client deliverable: one approved representative 8-week programme package in the canonical JSON structure accepted by `scripts/content/programmeContentContract.ts`.
- Exact package format: repository-relative JSON file that passes `pnpm content:programme:validate`.
- Exact approval evidence required:
  - completed `docs/client/PROGRAMME_CONTENT_APPROVAL_RECORD.md`
  - validation output
  - acceptance report output
  - import-plan output
- Exact publication authorization required:
  - explicit client/business approval
  - legal/claims confirmation
  - accessibility confirmation

## Validation sequence

1. collect the approved package through `docs/client/PROGRAMME_CONTENT_INTAKE_TEMPLATE.md`;
2. run `pnpm content:programme:validate -- <repository-relative-json-path>`;
3. run `pnpm content:programme:acceptance -- <repository-relative-json-path>`;
4. run `pnpm content:programme:import-plan -- <repository-relative-json-path>`;
5. complete `docs/client/PROGRAMME_CONTENT_APPROVAL_RECORD.md`;
6. keep `/portal/programme` preview-only until approval is explicit.

## No-go conditions

- no approved package received
- validation fails
- acceptance report flags missing representative content
- import plan is not reviewed
- legal/claims or accessibility approval is missing

## Approval record

- Approval decision: `[TO BE FILLED DURING APPROVAL]`
- Approved / rejected by: `[TO BE FILLED DURING APPROVAL]`
- Approval timestamp: `[TO BE FILLED DURING APPROVAL]`
- Evidence reference: `[TO BE FILLED DURING APPROVAL]`
- Execution owner confirmation: `[TO BE FILLED DURING APPROVAL]`
- Rollback owner confirmation: `[TO BE FILLED DURING APPROVAL]`

