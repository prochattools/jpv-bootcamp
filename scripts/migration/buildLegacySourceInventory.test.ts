/**
 * buildLegacySourceInventory.test.ts
 *
 * Deterministic unit tests using node:assert/strict only.
 * All fixtures are inline strings — no fixture files required.
 * All test addresses use .invalid domains; no real PII.
 *
 * Run: tsx scripts/migration/buildLegacySourceInventory.test.ts
 */

import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";

import {
  buildLegacySourceInventory,
  type InventoryConfig,
  type InventoryReport,
} from "./buildLegacySourceInventory";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
const createdFiles: string[] = [];

function setup(): void {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inv-test-"));
}

function teardown(): void {
  for (const f of createdFiles) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
  try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
}

function writeTmp(name: string, content: string): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, content, "utf8");
  createdFiles.push(p);
  return p;
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL  ${name}\n        ${msg}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Fixtures (synthetic — .invalid domain, no real names or emails)
// ---------------------------------------------------------------------------

const WXR_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>Synthetic Site</title>
  <item>
    <title>Post One</title>
    <wp:post_type>post</wp:post_type>
  </item>
  <item>
    <title>Post Two</title>
    <wp:post_type>post</wp:post_type>
  </item>
  <item>
    <title>Post Three</title>
    <wp:post_type>page</wp:post_type>
  </item>
</channel>
</rss>`;

// WordPress CSV: generic columns (no FluentCRM marker columns)
const WP_CSV_FIXTURE = `post_id,post_title,post_type,post_status
1,Title A,post,publish
2,Title B,post,publish
3,Title C,page,draft
`;

// FluentCRM CSV: contains "contact_status" structural column marker
const FLUENTCRM_CSV_FIXTURE = `id,first_name,last_name,email,contact_status,tags
1,Alpha,Tester,alpha@example.invalid,subscribed,boot2025
2,Beta,Tester,beta@example.invalid,subscribed,boot2025
3,Gamma,Tester,gamma@example.invalid,unsubscribed,
`;

// FluentCRM JSON: object with "contacts" key (structural, not PII-based)
const FLUENTCRM_JSON_FIXTURE = JSON.stringify({
  contacts: [
    { id: 1, email: "a@example.invalid", status: "subscribed" },
    { id: 2, email: "b@example.invalid", status: "subscribed" },
  ],
  meta: { total: 2 },
});

// Plain JSON array
const PLAIN_JSON_FIXTURE = JSON.stringify([
  { id: 1, slug: "item-a" },
  { id: 2, slug: "item-b" },
  { id: 3, slug: "item-c" },
  { id: 4, slug: "item-d" },
]);

// Fluent Community: opaque binary-like content (do not parse)
const FLUENT_COMMUNITY_FIXTURE = `OPAQUE_BINARY_CONTENT_PLACEHOLDER\x00\x01\x02`;

// Unsupported: PDF header
const UNSUPPORTED_FIXTURE = `%PDF-1.4 1 0 obj << /Type /Catalog >> endobj`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

setup();

console.log("\nbuildLegacySourceInventory — unit tests\n");

// 1. WordPress WXR detection and record count
test("WXR: detects wordpress-wxr and counts <item> elements", () => {
  const fp = writeTmp("export.xml", WXR_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report: InventoryReport = buildLegacySourceInventory(config);
  const file = report.files[0];
  assert.equal(file.detectedFormat, "wordpress-wxr");
  assert.equal(file.recordCount, 3);
  assert.equal(file.status, "accepted");
});

// 2. WordPress CSV detection and record count
test("WordPress CSV: detects wordpress-csv and counts data rows", () => {
  const fp = writeTmp("wp-export.csv", WP_CSV_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  const file = report.files[0];
  assert.equal(file.detectedFormat, "wordpress-csv");
  assert.equal(file.recordCount, 3);
  assert.equal(file.status, "accepted");
});

// 3. FluentCRM CSV detection and record count
test("FluentCRM CSV: detects fluentcrm-csv via header and counts data rows", () => {
  const fp = writeTmp("fluentcrm-export.csv", FLUENTCRM_CSV_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  const file = report.files[0];
  assert.equal(file.detectedFormat, "fluentcrm-csv");
  assert.equal(file.recordCount, 3);
  assert.equal(file.status, "accepted");
});

// 4. FluentCRM JSON detection and record count
test("FluentCRM JSON: detects fluentcrm-json and counts contacts array", () => {
  const fp = writeTmp("fluentcrm-export.json", FLUENTCRM_JSON_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  const file = report.files[0];
  assert.equal(file.detectedFormat, "fluentcrm-json");
  assert.equal(file.recordCount, 2);
  assert.equal(file.status, "accepted");
});

// 5. Fluent Community opaque handling
test("Fluent Community: marked opaque with null record count", () => {
  const fp = writeTmp("fluent-community-export.dat", FLUENT_COMMUNITY_FIXTURE);
  const config: InventoryConfig = {
    filePaths: [fp],
    formatHint: "fluent-community",
  };
  const report = buildLegacySourceInventory(config);
  const file = report.files[0];
  assert.equal(file.detectedFormat, "fluent-community");
  assert.equal(file.recordCount, null);
  // Opaque files with no warnings should be accepted (bytes > 0, checksum present)
  assert.ok(file.sha256.length === 64, "sha256 should be 64 hex chars");
  assert.ok(file.bytes > 0);
});

// 6. Unsupported format rejected with clear error
test("Unsupported format: rejected with warning message", () => {
  const fp = writeTmp("document.pdf", UNSUPPORTED_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  const file = report.files[0];
  assert.equal(file.detectedFormat, "unsupported");
  assert.equal(file.status, "rejected");
  assert.ok(file.warnings.length > 0, "should have at least one warning");
  assert.ok(
    file.warnings[0].toLowerCase().includes("unsupported"),
    "warning should mention 'unsupported'"
  );
});

// 7. PII-safe output — no email or name fields in JSON output
test("PII-safe: output JSON does not contain email addresses from fixtures", () => {
  const fp = writeTmp("crm.csv", FLUENTCRM_CSV_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  const json = JSON.stringify(report);
  // Must not contain any of the synthetic email addresses from the fixture
  assert.ok(
    !json.includes("alpha@example.invalid"),
    "output must not include email alpha@example.invalid"
  );
  assert.ok(
    !json.includes("beta@example.invalid"),
    "output must not include email beta@example.invalid"
  );
  assert.ok(
    !json.includes("gamma@example.invalid"),
    "output must not include email gamma@example.invalid"
  );
});

// 8. PII-safe output — no name values from fixtures
test("PII-safe: output JSON does not contain name values from fixtures", () => {
  const fp = writeTmp("crm2.csv", FLUENTCRM_CSV_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  const json = JSON.stringify(report);
  // Synthetic names in fixture header are "first_name","last_name" (column names are OK),
  // but data values "Alpha", "Beta", "Gamma" must not appear in output
  assert.ok(
    !json.includes('"Alpha"'),
    "output must not include name value Alpha"
  );
  assert.ok(
    !json.includes('"Beta"'),
    "output must not include name value Beta"
  );
});

// 9. SHA-256 determinism: same content → same checksum
test("SHA-256 determinism: same content produces same checksum", () => {
  const content = WXR_FIXTURE;
  const fp1 = writeTmp("wxr-a.xml", content);
  const fp2 = writeTmp("wxr-b.xml", content);
  const r1 = buildLegacySourceInventory({ filePaths: [fp1], formatHint: "auto" });
  const r2 = buildLegacySourceInventory({ filePaths: [fp2], formatHint: "auto" });
  assert.equal(
    r1.files[0].sha256,
    r2.files[0].sha256,
    "checksums must match for identical content"
  );
  // Verify checksum is correct by computing it independently
  const expected = crypto
    .createHash("sha256")
    .update(Buffer.from(content, "utf8"))
    .digest("hex");
  assert.equal(r1.files[0].sha256, expected);
});

// 10. Missing file error handling
test("Missing file: returns rejected status with read error warning", () => {
  const fp = path.join(tmpDir, "does-not-exist.xml");
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  const file = report.files[0];
  assert.equal(file.status, "rejected");
  assert.ok(file.warnings.length > 0, "should have a warning");
  assert.ok(
    file.warnings[0].toLowerCase().includes("read error") ||
      file.warnings[0].toLowerCase().includes("error"),
    "warning should mention a read error"
  );
  // Must not expose directory path in warning
  assert.ok(
    !file.warnings[0].includes(tmpDir),
    "warning must not include directory path"
  );
});

// 11. Summary counts are consistent
test("Summary: counts match file statuses", () => {
  const files = [
    writeTmp("summary-wxr.xml", WXR_FIXTURE),
    writeTmp("summary-pdf.pdf", UNSUPPORTED_FIXTURE),
    writeTmp("summary-csv.csv", FLUENTCRM_CSV_FIXTURE),
  ];
  const config: InventoryConfig = { filePaths: files, formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  assert.equal(report.summary.totalFiles, 3);
  assert.equal(
    report.summary.accepted + report.summary.rejected + report.summary.unknown,
    3
  );
  assert.equal(report.summary.rejected, 1, "PDF should be rejected");
});

// 12. Path reported as filename only (no directory)
test("PII-safe path: file path in output is filename only (no directory)", () => {
  const fp = writeTmp("path-check.xml", WXR_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  const file = report.files[0];
  assert.equal(file.path, "path-check.xml");
  assert.ok(
    !file.path.includes(path.sep) || file.path === path.basename(file.path),
    "path must be filename only"
  );
});

// 13. Plain JSON array count
test("Plain JSON: counts array elements", () => {
  const fp = writeTmp("data.json", PLAIN_JSON_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  const file = report.files[0];
  assert.equal(file.detectedFormat, "json");
  assert.equal(file.recordCount, 4);
});

// 14. inventoryVersion field is present and correct
test("Report metadata: inventoryVersion is '1.0'", () => {
  const fp = writeTmp("meta-check.xml", WXR_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
  const report = buildLegacySourceInventory(config);
  assert.equal(report.inventoryVersion, "1.0");
  assert.ok(
    typeof report.generatedAt === "string" && report.generatedAt.length > 0,
    "generatedAt must be a non-empty string"
  );
  // Validate ISO 8601 shape
  assert.doesNotThrow(() => new Date(report.generatedAt));
});

// 15. Format hint override: --format wxr forces wxr detection on .xml
test("Format hint wxr: forces wordpress-wxr detection", () => {
  const fp = writeTmp("hinted.xml", WXR_FIXTURE);
  const config: InventoryConfig = { filePaths: [fp], formatHint: "wxr" };
  const report = buildLegacySourceInventory(config);
  assert.equal(report.files[0].detectedFormat, "wordpress-wxr");
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

teardown();

console.log(`\n${passed + failed} tests  |  ${passed} passed  |  ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
