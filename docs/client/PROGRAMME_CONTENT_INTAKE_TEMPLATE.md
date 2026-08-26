# Programme Content Intake Template

Status: `CLIENT TO COMPLETE`  
Branch: `feature/course-branding-and-preview`  
Purpose: provide one complete representative 8-week programme package that can be converted into the canonical repository intake file and validated without touching Payload, Prisma, Stripe, email providers, or production systems.

## Completion instructions

1. Replace every `[CLIENT TO PROVIDE]` blank.
2. Keep the eight week sections in order.
3. Do not leave placeholder markers such as `TODO`, `TBD`, `lorem ipsum`, `example content`, `coming soon`, or `placeholder`.
4. If a field is intentionally not supplied, mark it `N/A` only when the field is explicitly optional.
5. Client approval and publication approval are separate. Do not mark the package approved until the approval record is complete.

## Required vs optional

- Required: programme identifier, title, short summary, long description, version, locale, all eight weeks, week ordering, lesson ordering, learning outcomes, estimated durations, lesson summaries, lesson body references, approval metadata, accessibility labels for resources.
- Optional: lesson video reference, lesson resources, approval notes.

## Canonical machine-readable target

The completed content must be converted into one repository JSON package that matches `scripts/content/programmeContentContract.ts` and validates with:

```sh
pnpm content:programme:validate -- <repository-relative-json-path>
pnpm content:programme:acceptance -- <repository-relative-json-path>
pnpm content:programme:import-plan -- <repository-relative-json-path>
```

Required JSON top-level keys:

- `packageFormat: "jpv-programme-content.v1"`
- `packagePurpose: "client_submission"`
- `programme`
- `weeks`
- `approval`

## Programme

- package purpose: `[CLIENT TO PROVIDE: client_submission]`
- programme id (slug-safe stable identifier): `[CLIENT TO PROVIDE]`
- programme title: `[CLIENT TO PROVIDE]`
- short summary: `[CLIENT TO PROVIDE]`
- long description: `[CLIENT TO PROVIDE]`
- version: `[CLIENT TO PROVIDE]`
- status (`draft`, `review`, or `approved`): `[CLIENT TO PROVIDE]`
- locale (for example `en-GB`): `[CLIENT TO PROVIDE]`
- week count: `8`
- publication intent (`preview_only`, `candidate`, or `approved_for_import`): `[CLIENT TO PROVIDE]`

## Week 1

- week id: `[CLIENT TO PROVIDE]`
- week slug: `[CLIENT TO PROVIDE]`
- sequence: `1`
- title: `[CLIENT TO PROVIDE]`
- summary: `[CLIENT TO PROVIDE]`
- learning outcomes:
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
- estimated duration: `[CLIENT TO PROVIDE]`
- status (`draft`, `review`, or `approved`): `[CLIENT TO PROVIDE]`

### Lesson template

- lesson id: `[CLIENT TO PROVIDE]`
- lesson slug: `[CLIENT TO PROVIDE]`
- lesson sequence: `[CLIENT TO PROVIDE]`
- lesson title: `[CLIENT TO PROVIDE]`
- lesson summary: `[CLIENT TO PROVIDE]`
- lesson body/content reference: `[CLIENT TO PROVIDE]`
- lesson estimated duration: `[CLIENT TO PROVIDE]`
- lesson type (`video`, `reading`, `worksheet`, `exercise`, or `call`): `[CLIENT TO PROVIDE]`
- preview available (`true` or `false`): `[CLIENT TO PROVIDE]`
- video reference (optional): `[CLIENT TO PROVIDE]`
- lesson status (`draft`, `review`, or `approved`): `[CLIENT TO PROVIDE]`

### Resource template

- resource id: `[CLIENT TO PROVIDE]`
- label: `[CLIENT TO PROVIDE]`
- resource type (`download`, `link`, or `video_reference`): `[CLIENT TO PROVIDE]`
- source reference (https URL or repository-relative path): `[CLIENT TO PROVIDE]`
- accessibility label: `[CLIENT TO PROVIDE]`
- resource status (`draft`, `approved`, or `archived`): `[CLIENT TO PROVIDE]`

## Week 2

- week id: `[CLIENT TO PROVIDE]`
- week slug: `[CLIENT TO PROVIDE]`
- sequence: `2`
- title: `[CLIENT TO PROVIDE]`
- summary: `[CLIENT TO PROVIDE]`
- learning outcomes:
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
- estimated duration: `[CLIENT TO PROVIDE]`
- status: `[CLIENT TO PROVIDE]`

## Week 3

- week id: `[CLIENT TO PROVIDE]`
- week slug: `[CLIENT TO PROVIDE]`
- sequence: `3`
- title: `[CLIENT TO PROVIDE]`
- summary: `[CLIENT TO PROVIDE]`
- learning outcomes:
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
- estimated duration: `[CLIENT TO PROVIDE]`
- status: `[CLIENT TO PROVIDE]`

## Week 4

- week id: `[CLIENT TO PROVIDE]`
- week slug: `[CLIENT TO PROVIDE]`
- sequence: `4`
- title: `[CLIENT TO PROVIDE]`
- summary: `[CLIENT TO PROVIDE]`
- learning outcomes:
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
- estimated duration: `[CLIENT TO PROVIDE]`
- status: `[CLIENT TO PROVIDE]`

## Week 5

- week id: `[CLIENT TO PROVIDE]`
- week slug: `[CLIENT TO PROVIDE]`
- sequence: `5`
- title: `[CLIENT TO PROVIDE]`
- summary: `[CLIENT TO PROVIDE]`
- learning outcomes:
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
- estimated duration: `[CLIENT TO PROVIDE]`
- status: `[CLIENT TO PROVIDE]`

## Week 6

- week id: `[CLIENT TO PROVIDE]`
- week slug: `[CLIENT TO PROVIDE]`
- sequence: `6`
- title: `[CLIENT TO PROVIDE]`
- summary: `[CLIENT TO PROVIDE]`
- learning outcomes:
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
- estimated duration: `[CLIENT TO PROVIDE]`
- status: `[CLIENT TO PROVIDE]`

## Week 7

- week id: `[CLIENT TO PROVIDE]`
- week slug: `[CLIENT TO PROVIDE]`
- sequence: `7`
- title: `[CLIENT TO PROVIDE]`
- summary: `[CLIENT TO PROVIDE]`
- learning outcomes:
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
- estimated duration: `[CLIENT TO PROVIDE]`
- status: `[CLIENT TO PROVIDE]`

## Week 8

- week id: `[CLIENT TO PROVIDE]`
- week slug: `[CLIENT TO PROVIDE]`
- sequence: `8`
- title: `[CLIENT TO PROVIDE]`
- summary: `[CLIENT TO PROVIDE]`
- learning outcomes:
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
  - `[CLIENT TO PROVIDE]`
- estimated duration: `[CLIENT TO PROVIDE]`
- status: `[CLIENT TO PROVIDE]`

## Accessibility checklist

- [ ] Every resource has an accessibility label.
- [ ] Every linked file has a descriptive label, not only a filename.
- [ ] Video or audio references have a transcript, captions, or an operator note explaining the planned accessible alternative.
- [ ] No lesson summary or body reference depends on inaccessible images alone.

## Claims and evidence checklist

- [ ] Learning claims reflect approved copy only.
- [ ] No unsupported guarantees, earnings claims, or legal promises appear.
- [ ] Every external proof, case study, or testimonial reference has a source the operator can review.

## Prohibited content markers

Do not submit any of these markers in the completed package:

- `TODO`
- `TBD`
- `lorem ipsum`
- `example content`
- `coming soon`
- `placeholder`

## Approval section

- approval status (`not_approved`, `approved`, or `rejected`): `[CLIENT TO PROVIDE]`
- approver: `[CLIENT TO PROVIDE]`
- approval date (`YYYY-MM-DD`): `[CLIENT TO PROVIDE]`
- approval evidence reference: `[CLIENT TO PROVIDE]`
- explicit client approval (`true` or `false`): `[CLIENT TO PROVIDE]`
- publication approved (`true` or `false`): `[CLIENT TO PROVIDE]`
- approval notes (optional): `[CLIENT TO PROVIDE]`

## Publication approval checklist

- [ ] All eight weeks are complete.
- [ ] Lesson ordering is final.
- [ ] Resource references are final and safe.
- [ ] Accessibility labels are complete.
- [ ] Client approval evidence exists.
- [ ] Publication approval is explicit.
- [ ] Operator can create an acceptance report and import plan from the final JSON package.
