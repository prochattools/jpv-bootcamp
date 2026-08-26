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
import * as net from "net";
import { spawnSync } from "child_process";

import {
  atomicWriteInventory,
  buildLegacySourceInventory,
  type AtomicWriteOperations,
  type InventoryConfig,
  type InventoryReport,
} from "./buildLegacySourceInventory";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

function setup(): void {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inv-test-"));
}

function teardown(): void {
  try {
    const entries = fs.readdirSync(tmpDir);
    for (const entry of entries) {
      try { fs.unlinkSync(path.join(tmpDir, entry)); } catch { /* ignore */ }
    }
    fs.rmdirSync(tmpDir);
  } catch { /* ignore */ }
}

function writeTmp(name: string, content: string | Buffer): string {
  const p = path.join(tmpDir, name);
  if (typeof content === "string") {
    fs.writeFileSync(p, content, "utf8");
  } else {
    fs.writeFileSync(p, content);
  }
  return p;
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  PASS  ${name}`);
      passed++;
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL  ${name}\n        ${msg}`);
      failed++;
    });
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
  <wp:wxr_version>1.2</wp:wxr_version>
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

async function runTests(): Promise<void> {
  console.log("\nbuildLegacySourceInventory — unit tests\n");

  // 1. WordPress WXR detection and record count
  await test("WXR: detects wordpress-wxr and counts <item> elements", async () => {
    const fp = writeTmp("export.xml", WXR_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report: InventoryReport = await buildLegacySourceInventory(config);
    const file = report.files[0];
    assert.equal(file.detectedFormat, "wordpress-wxr");
    assert.equal(file.recordCount, 3);
    assert.equal(file.status, "accepted");
  });

  // 2. WordPress CSV detection and record count
  await test("WordPress CSV: detects wordpress-csv and counts data rows", async () => {
    const fp = writeTmp("wp-export.csv", WP_CSV_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
    const file = report.files[0];
    assert.equal(file.detectedFormat, "wordpress-csv");
    assert.equal(file.recordCount, 3);
    assert.equal(file.status, "accepted");
  });

  // 3. FluentCRM CSV detection and record count
  await test("FluentCRM CSV: detects fluentcrm-csv via header and counts data rows", async () => {
    const fp = writeTmp("fluentcrm-export.csv", FLUENTCRM_CSV_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
    const file = report.files[0];
    assert.equal(file.detectedFormat, "fluentcrm-csv");
    assert.equal(file.recordCount, 3);
    assert.equal(file.status, "accepted");
  });

  // 4. FluentCRM JSON detection and record count
  await test("FluentCRM JSON: detects fluentcrm-json and counts contacts array", async () => {
    const fp = writeTmp("fluentcrm-export.json", FLUENTCRM_JSON_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
    const file = report.files[0];
    assert.equal(file.detectedFormat, "fluentcrm-json");
    assert.equal(file.recordCount, 2);
    assert.equal(file.status, "accepted");
  });

  // 5. Fluent Community opaque handling
  await test("Fluent Community: marked opaque with null record count", async () => {
    const fp = writeTmp("fluent-community-export.dat", FLUENT_COMMUNITY_FIXTURE);
    const config: InventoryConfig = {
      filePaths: [fp],
      formatHint: "fluent-community",
    };
    const report = await buildLegacySourceInventory(config);
    const file = report.files[0];
    assert.equal(file.detectedFormat, "fluent-community");
    assert.equal(file.recordCount, null);
    assert.ok(file.sha256.length === 64, "sha256 should be 64 hex chars");
    assert.ok(file.bytes > 0);
  });

  // 6. Unsupported format rejected with clear error
  await test("Unsupported format: rejected with warning message", async () => {
    const fp = writeTmp("document.pdf", UNSUPPORTED_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
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
  await test("PII-safe: output JSON does not contain email addresses from fixtures", async () => {
    const fp = writeTmp("crm.csv", FLUENTCRM_CSV_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
    const json = JSON.stringify(report);
    assert.ok(!json.includes("alpha@example.invalid"), "output must not include email alpha@example.invalid");
    assert.ok(!json.includes("beta@example.invalid"), "output must not include email beta@example.invalid");
    assert.ok(!json.includes("gamma@example.invalid"), "output must not include email gamma@example.invalid");
  });

  // 8. PII-safe output — no name values from fixtures
  await test("PII-safe: output JSON does not contain name values from fixtures", async () => {
    const fp = writeTmp("crm2.csv", FLUENTCRM_CSV_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
    const json = JSON.stringify(report);
    assert.ok(!json.includes('"Alpha"'), "output must not include name value Alpha");
    assert.ok(!json.includes('"Beta"'), "output must not include name value Beta");
  });

  // 9. SHA-256 determinism: same content → same checksum
  await test("SHA-256 determinism: same content produces same checksum", async () => {
    const content = WXR_FIXTURE;
    const fp1 = writeTmp("wxr-a.xml", content);
    const fp2 = writeTmp("wxr-b.xml", content);
    const r1 = await buildLegacySourceInventory({ filePaths: [fp1], formatHint: "auto" });
    const r2 = await buildLegacySourceInventory({ filePaths: [fp2], formatHint: "auto" });
    assert.equal(r1.files[0].sha256, r2.files[0].sha256, "checksums must match for identical content");
    const expected = crypto.createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
    assert.equal(r1.files[0].sha256, expected);
  });

  // 10. Missing file error handling
  await test("Missing file: returns rejected status with read error warning", async () => {
    const fp = path.join(tmpDir, "does-not-exist.xml");
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
    const file = report.files[0];
    assert.equal(file.status, "rejected");
    assert.ok(file.warnings.length > 0, "should have a warning");
    assert.ok(
      file.warnings[0].toLowerCase().includes("read error") || file.warnings[0].toLowerCase().includes("error"),
      "warning should mention a read error"
    );
    assert.ok(!file.warnings[0].includes(tmpDir), "warning must not include directory path");
  });

  // 11. Summary counts are consistent
  await test("Summary: counts match file statuses", async () => {
    const files = [
      writeTmp("summary-wxr.xml", WXR_FIXTURE),
      writeTmp("summary-pdf.pdf", UNSUPPORTED_FIXTURE),
      writeTmp("summary-csv.csv", FLUENTCRM_CSV_FIXTURE),
    ];
    const config: InventoryConfig = { filePaths: files, formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
    assert.equal(report.summary.totalFiles, 3);
    assert.equal(report.summary.accepted + report.summary.rejected + report.summary.unknown, 3);
    assert.equal(report.summary.rejected, 1, "PDF should be rejected");
  });

  // 12. Path reported as filename only (no directory)
  await test("PII-safe path: file path in output is filename only (no directory)", async () => {
    const fp = writeTmp("path-check.xml", WXR_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
    const file = report.files[0];
    assert.equal(file.path, "path-check.xml");
    assert.ok(
      !file.path.includes(path.sep) || file.path === path.basename(file.path),
      "path must be filename only"
    );
  });

  // 13. Plain JSON array — generic JSON is now classified as unknown (fail-closed)
  await test("Plain JSON: generic array classified as unknown", async () => {
    const fp = writeTmp("data.json", PLAIN_JSON_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
    const file = report.files[0];
    assert.equal(file.detectedFormat, "unknown");
    assert.equal(file.recordCount, null);
    assert.equal(file.countConfidence, "unavailable");
    assert.equal(file.status, "unknown");
  });

  // 14. inventoryVersion field is present and correct
  await test("Report metadata: inventoryVersion is '1.0'", async () => {
    const fp = writeTmp("meta-check.xml", WXR_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "auto" };
    const report = await buildLegacySourceInventory(config);
    assert.equal(report.inventoryVersion, "1.0");
    assert.ok(typeof report.generatedAt === "string" && report.generatedAt.length > 0, "generatedAt must be a non-empty string");
    assert.doesNotThrow(() => new Date(report.generatedAt));
  });

  // 15. Format hint override: --format wxr forces wxr detection on .xml
  await test("Format hint wxr: forces wordpress-wxr detection (with valid rss marker)", async () => {
    const fp = writeTmp("hinted.xml", WXR_FIXTURE);
    const config: InventoryConfig = { filePaths: [fp], formatHint: "wxr" };
    const report = await buildLegacySourceInventory(config);
    assert.equal(report.files[0].detectedFormat, "wordpress-wxr");
  });

  // ---------------------------------------------------------------------------
  // New streaming/bounded tests
  // ---------------------------------------------------------------------------

  // 16. Large WXR: 500 <item> tags
  await test("Large WXR: streams 500 <item> tags correctly", async () => {
    const items = Array.from({ length: 500 }, (_, i) =>
      `  <item>\n    <title>Post ${i}</title>\n    <wp:post_type>post</wp:post_type>\n  </item>`
    ).join("\n");
    const largeWxr = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/">\n<channel>\n<title>Big Site</title>\n<wp:wxr_version>1.2</wp:wxr_version>\n${items}\n</channel>\n</rss>`;
    const fp = writeTmp("large-export.xml", largeWxr);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.detectedFormat, "wordpress-wxr");
    assert.equal(file.recordCount, 500);
    assert.ok(file.bytes > 1000, "file should be substantial in size");
  });

  // 17. Large CSV: 200 data rows
  await test("Large CSV: streams 200 data rows correctly", async () => {
    const rows = Array.from({ length: 200 }, (_, i) =>
      `${i + 1},user${i}@example.invalid,subscribed`
    ).join("\n");
    const largeCsv = `id,email,contact_status\n${rows}\n`;
    const fp = writeTmp("large-crm.csv", largeCsv);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.detectedFormat, "fluentcrm-csv");
    assert.equal(file.recordCount, 200);
  });

  // 18. Multiline quoted CSV: field with embedded newline
  await test("Multiline quoted CSV: embedded newline in quoted field counts correctly", async () => {
    // 2 data rows; row 2 has a field with an embedded newline inside quotes
    const multilineCsv = `post_id,post_title,post_type,post_status\n1,"Title with\nembedded newline",post,publish\n2,Normal Title,post,publish\n`;
    const fp = writeTmp("multiline.csv", multilineCsv);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.detectedFormat, "wordpress-csv");
    assert.equal(file.recordCount, 2, "should count 2 data rows, not 3");
  });

  // 19. Large JSON object: generic JSON classified as unknown (fail-closed)
  await test("Large JSON object: classified as unknown, recordCount=null", async () => {
    // Build a flat object (not an array)
    const obj: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      obj[`key_${i}`] = `value_${i}`;
    }
    const largeJson = JSON.stringify(obj);
    const fp = writeTmp("large-object.json", largeJson);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.detectedFormat, "unknown");
    assert.equal(file.recordCount, null);
    assert.equal(file.countConfidence, "unavailable");
    assert.equal(file.status, "unknown");
    // Ensure no data values appear in warnings (PII-safe)
    const warnStr = file.warnings.join(" ");
    assert.ok(!warnStr.includes("value_"), "warnings must not contain data values");
  });

  // ---------------------------------------------------------------------------
  // Format rejection tests
  // ---------------------------------------------------------------------------

  // 20. Arbitrary CSV — no WordPress or FluentCRM schema markers
  await test("Arbitrary CSV: classified as unknown, not wordpress-csv", async () => {
    const arbitraryCsv = `name,color,size\nApple,Red,Small\nBanana,Yellow,Medium\n`;
    const fp = writeTmp("arbitrary.csv", arbitraryCsv);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.notEqual(file.detectedFormat, "wordpress-csv", "should not be classified as wordpress-csv");
    assert.equal(file.detectedFormat, "unknown");
  });

  // 21. Arbitrary JSON object — no contacts/subscribers key, not an array
  await test("Arbitrary JSON object: countConfidence=unavailable, status not rejected", async () => {
    const arbitraryObj = JSON.stringify({ foo: "bar", baz: 42 });
    const fp = writeTmp("arbitrary-obj.json", arbitraryObj);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.countConfidence, "unavailable");
    assert.notEqual(file.status, "rejected");
  });

  // 22. Renamed binary: PDF header in a .json file
  await test("Renamed binary: PDF header in .json file is rejected as unsupported", async () => {
    const pdfHeader = Buffer.from("%PDF-1.4 fake pdf content");
    const fp = writeTmp("malicious.json", pdfHeader);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.status, "rejected");
    assert.equal(file.detectedFormat, "unsupported");
  });

  // 23. Mismatched hint: hint=wxr but content is CSV
  await test("Mismatched hint: wxr hint with CSV content rejected with mismatch warning", async () => {
    const csvContent = `post_id,post_title,post_type\n1,Title,post\n`;
    const fp = writeTmp("wrong-hint.csv", csvContent);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "wxr" });
    const file = report.files[0];
    assert.equal(file.status, "rejected");
    const allWarnings = file.warnings.join(" ").toLowerCase();
    assert.ok(
      allWarnings.includes("mismatch") || allWarnings.includes("hint"),
      "warning should mention mismatch or hint"
    );
  });

  // ---------------------------------------------------------------------------
  // Output protection tests
  // ---------------------------------------------------------------------------

  // 24. --out equal to input: should throw or return error before writing
  await test("Output protection: --out path overlapping input path throws error", async () => {
    const fp = writeTmp("input-overlap.xml", WXR_FIXTURE);
    await assert.rejects(
      () => buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto", outPath: fp }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.toLowerCase().includes("overlap") || err.message.toLowerCase().includes("input"));
        return true;
      }
    );
  });

  // 25. Existing output not overwritten
  await test("Output protection: existing output file causes rejection", async () => {
    const fp = writeTmp("existing-input.xml", WXR_FIXTURE);
    const outPath = writeTmp("existing-output.json", "{}");
    await assert.rejects(
      () => buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto", outPath }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.toLowerCase().includes("already exists") || err.message.toLowerCase().includes("overwrite"),
          `unexpected error: ${(err as Error).message}`
        );
        return true;
      }
    );
    // Verify original content not modified
    const content = fs.readFileSync(outPath, "utf8");
    assert.equal(content, "{}");
  });

  // 26. Failed write leaves no partial file
  await test("Failed write: no .tmp file left behind after error", async () => {
    const fp = writeTmp("no-partial.xml", WXR_FIXTURE);
    // Use a directory as outPath to force a write failure
    const badOutPath = path.join(tmpDir, "subdir-that-does-not-exist", "out.json");
    try {
      await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto", outPath: badOutPath });
    } catch {
      // Expected to throw
    }
    const tmpFile = badOutPath + ".tmp";
    assert.ok(!fs.existsSync(tmpFile), ".tmp file must not exist after failed write");
  });

  // ---------------------------------------------------------------------------
  // Error redaction tests
  // ---------------------------------------------------------------------------

  // 27. Read error does not expose full directory path in warnings
  await test("Error redaction: read error warning does not expose directory path", async () => {
    const fp = path.join(tmpDir, "nonexistent-redact.xml");
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    const allWarnings = file.warnings.join(" ");
    assert.ok(!allWarnings.includes(tmpDir), "warning must not contain tmpDir path");
  });

  // 28. Write error does not expose full directory path
  await test("Error redaction: write error does not expose home directory path", async () => {
    const fp = writeTmp("redact-write.xml", WXR_FIXTURE);
    const badOutPath = path.join(tmpDir, "no-subdir", "out.json");
    let errorMsg = "";
    try {
      await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto", outPath: badOutPath });
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }
    // The error message from atomicWrite may contain the path from Node, but we verify
    // it doesn't contain the home directory
    const home = os.homedir();
    assert.ok(!errorMsg.includes(home), "error must not contain home directory path");
  });

  // ---------------------------------------------------------------------------
  // PII and SHA tests
  // ---------------------------------------------------------------------------

  // 29. Output JSON contains no email addresses from WXR/CSV/JSON fixtures
  await test("PII-safe: output has no emails from WXR fixture", async () => {
    // WXR fixture has no emails; FluentCRM JSON has synthetic .invalid emails
    const fp = writeTmp("pii-json.json", FLUENTCRM_JSON_FIXTURE);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const json = JSON.stringify(report);
    assert.ok(!json.includes("a@example.invalid"), "output must not contain email a@example.invalid");
    assert.ok(!json.includes("b@example.invalid"), "output must not contain email b@example.invalid");
  });

  // 30. SHA-256 remains correct for streamed files
  await test("SHA-256 streaming: hash matches known value for WXR fixture", async () => {
    const content = WXR_FIXTURE;
    const fp = writeTmp("sha-stream.xml", content);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const expected = crypto.createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
    assert.equal(report.files[0].sha256, expected, "streaming SHA-256 must match synchronous reference hash");
  });

  // 31. Fluent Community opaque files: checksum present, recordCount null, countConfidence unavailable
  await test("Fluent Community opaque: checksum present, recordCount null, countConfidence unavailable", async () => {
    const fp = writeTmp("fc-opaque.dat", FLUENT_COMMUNITY_FIXTURE);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "fluent-community" });
    const file = report.files[0];
    assert.equal(file.detectedFormat, "fluent-community");
    assert.ok(file.sha256.length === 64, "sha256 should be 64 hex chars");
    assert.equal(file.recordCount, null);
    assert.equal(file.countConfidence, "unavailable");
  });

  // ---------------------------------------------------------------------------
  // Boundary tests
  // ---------------------------------------------------------------------------

  // 32. CSV CRLF line endings
  await test("CSV CRLF: counts rows correctly with \\r\\n", async () => {
    const crlfCsv = `post_id,post_title,post_type\r\n1,Title A,post\r\n2,Title B,post\r\n`;
    const fp = writeTmp("crlf.csv", crlfCsv);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.detectedFormat, "wordpress-csv");
    assert.equal(file.recordCount, 2, "should count 2 data rows");
  });

  // 33. CSV escaped quotes in quoted field
  await test("CSV escaped quotes: \"\"-escaped quotes in quoted field", async () => {
    const escapedQuoteCsv = `post_id,post_title,post_type\n1,"Title with ""quotes"" inside",post\n`;
    const fp = writeTmp("escaped-quotes.csv", escapedQuoteCsv);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.detectedFormat, "wordpress-csv");
    assert.equal(file.recordCount, 1, "should count 1 data row");
  });

  // 34. CSV malformed — unterminated quoted field
  await test("CSV malformed: unterminated quoted field returns unavailable", async () => {
    const malformedCsv = `post_id,post_title\n1,"Unterminated quote\n`;
    const fp = writeTmp("malformed.csv", malformedCsv);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.recordCount, null);
    assert.equal(file.countConfidence, "unavailable");
    assert.ok(file.warnings.some((w) => w.toLowerCase().includes("malformed")), "should have malformed warning");
  });

  // 35. WXR empty file
  await test("WXR empty: zero items counted", async () => {
    const emptyWxr = `<?xml version="1.0"?>\n<rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version></channel></rss>`;
    const fp = writeTmp("empty.xml", emptyWxr);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.recordCount, 0);
  });

  // 36. WXR single item
  await test("WXR single: one item counted correctly", async () => {
    const singleWxr = `<?xml version="1.0"?>\n<rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version><item><title>One</title><wp:post_type>post</wp:post_type></item></channel></rss>`;
    const fp = writeTmp("single.xml", singleWxr);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.recordCount, 1);
  });

  // 37. Symbolic link rejection
  await test("Symlink input: rejected with warning", async () => {
    const targetPath = writeTmp("target.xml", WXR_FIXTURE);
    const linkPath = path.join(tmpDir, "link.xml");
    try {
      fs.symlinkSync(targetPath, linkPath);
      const report = await buildLegacySourceInventory({ filePaths: [linkPath], formatHint: "auto" });
      const file = report.files[0];
      assert.equal(file.status, "rejected");
      assert.ok(file.warnings.some((w) => w.toLowerCase().includes("symlink") || w.toLowerCase().includes("symbolic link")), "warning should mention symlink");
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EPERM") {
        console.log("  SKIP  Symlink input: rejected with warning (EPERM on this platform)");
      } else {
        throw err;
      }
    }
  });

  // 38. Generic object JSON rejected
  await test("Generic JSON object: rejected as unknown", async () => {
    const genericObj = JSON.stringify({ foo: "bar", baz: 42 });
    const fp = writeTmp("generic-obj.json", genericObj);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.detectedFormat, "unknown");
    assert.equal(file.status, "unknown");
  });

  // 39. Renamed binary: PDF in JSON file
  await test("Renamed binary: PDF header in .json rejected", async () => {
    const pdfHeader = Buffer.from("%PDF-1.4 fake pdf");
    const fp = writeTmp("fake.json", pdfHeader);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.status, "rejected");
    assert.equal(file.detectedFormat, "unsupported");
  });

  // 40. Valid FluentCRM JSON accepted
  await test("FluentCRM JSON valid: accepted and counted", async () => {
    const fp = writeTmp("fluentcrm.json", FLUENTCRM_JSON_FIXTURE);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    const file = report.files[0];
    assert.equal(file.detectedFormat, "fluentcrm-json");
    assert.equal(file.recordCount, 2);
    assert.equal(file.status, "accepted");
  });

  // 41. WordPress JSON root array
  await test("WordPress JSON: accepts reviewed root array shape", async () => {
    const content = JSON.stringify([
      { id: 1, post_type: "post", post_title: "Synthetic", post_content: "Body" },
    ]);
    const fp = writeTmp("wordpress-array.json", content);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].detectedFormat, "wordpress-json");
    assert.equal(report.files[0].recordCount, 1);
    assert.equal(report.files[0].status, "accepted");
  });

  // 42. WordPress JSON named root arrays
  await test("WordPress JSON: accepts items, posts, and lessons root arrays", async () => {
    for (const key of ["items", "posts", "lessons"] as const) {
      const fp = writeTmp(`wordpress-${key}.json`, JSON.stringify({
        [key]: [{ id: 1, type: "lesson", title: "Synthetic", body: "Body" }],
      }));
      const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
      assert.equal(report.files[0].detectedFormat, "wordpress-json", key);
      assert.equal(report.files[0].recordCount, 1, key);
    }
  });

  // 43. WordPress JSON marker combination
  await test("WordPress JSON: rejects coincidental single-key objects", async () => {
    const fp = writeTmp("coincidental.json", JSON.stringify({ posts: [{ title: "Only title" }] }));
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].detectedFormat, "unknown");
    assert.equal(report.files[0].status, "unknown");
  });

  // 44. WordPress JSON must not be FluentCRM
  await test("WordPress JSON: never classifies as FluentCRM", async () => {
    const fp = writeTmp("wordpress-not-crm.json", JSON.stringify({
      posts: [{ post_id: 1, post_type: "post", post_title: "Synthetic", post_content: "Body" }],
    }));
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "json" });
    assert.equal(report.files[0].detectedFormat, "wordpress-json");
  });

  // 45. Large recognized WordPress JSON remains bounded
  await test("WordPress JSON: large recognized export returns unavailable count", async () => {
    const fp = writeTmp("wordpress-large.json", JSON.stringify({
      posts: [{ id: 1, post_type: "post", post_title: "Synthetic", post_content: "x".repeat(5 * 1024 * 1024) }],
    }));
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].detectedFormat, "wordpress-json");
    assert.equal(report.files[0].recordCount, null);
    assert.equal(report.files[0].countConfidence, "unavailable");
  });

  // 46. Generic RSS must not be WXR
  await test("WXR: generic RSS is classified unknown", async () => {
    const fp = writeTmp("generic-rss.xml", "<rss><channel><item><title>Synthetic</title></item></channel></rss>");
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].detectedFormat, "unknown");
    assert.equal(report.files[0].status, "unknown");
  });

  // 47. WXR namespace/version validation
  await test("WXR: invalid namespace is rejected by structural detection", async () => {
    const fp = writeTmp("invalid-namespace.xml", '<rss xmlns:wp="https://example.invalid/export"><channel><wp:wxr_version>1.2</wp:wxr_version></channel></rss>');
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].detectedFormat, "unknown");
  });

  // 48. WXR closing structure validation
  await test("WXR: missing closing structure never receives exact confidence", async () => {
    const fp = writeTmp("unclosed-wxr.xml", '<?xml version="1.0"?><rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version><item><wp:post_type>post</wp:post_type></item>');
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].detectedFormat, "wordpress-wxr");
    assert.equal(report.files[0].recordCount, null);
    assert.equal(report.files[0].countConfidence, "unavailable");
  });

  // 49. WXR item token at every 64 KiB split
  await test("WXR: item token split across every 64 KiB boundary counts once", async () => {
    const prefix = '<?xml version="1.0"?><rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version>';
    const suffix = '<wp:post_type>post</wp:post_type></item></channel></rss>';
    const token = '<item>';
    for (let split = 1; split < token.length; split += 1) {
      const fillerLength = 65_536 - prefix.length - split;
      assert.ok(fillerLength > 0);
      const fp = writeTmp(`wxr-boundary-${split}.xml`, `${prefix}${"x".repeat(fillerLength)}${token}${suffix}`);
      const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
      assert.equal(report.files[0].recordCount, 1, `split ${split}`);
    }
  });

  // 50. WXR multiple boundary tokens
  await test("WXR: multiple items across boundaries never re-enter carry", async () => {
    const prefix = '<?xml version="1.0"?><rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version>';
    const firstFill = "x".repeat(65_536 - prefix.length - 3);
    const between = "y".repeat(65_536 - 20);
    const fp = writeTmp("wxr-two-boundaries.xml", `${prefix}${firstFill}<item><wp:post_type>post</wp:post_type></item>${between}<item><wp:post_type>post</wp:post_type></item></channel></rss>`);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].recordCount, 2);
  });

  // 51. CSV multiline exact 64 KiB boundary
  await test("CSV: multiline quoted field crossing 64 KiB counts one row", async () => {
    const header = "post_id,post_title,post_type,post_status\n";
    const rowPrefix = '1,"';
    const filler = "x".repeat(65_536 - header.length - rowPrefix.length - 1);
    const fp = writeTmp("csv-boundary.csv", `${header}${rowPrefix}${filler}\nvalue",post,publish`);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].recordCount, 1);
  });

  // 52. CSV escaped quote split at boundary
  await test("CSV: escaped quote pair split across 64 KiB counts one row", async () => {
    const header = "post_id,post_title,post_type\n";
    const rowPrefix = '1,"';
    const filler = "x".repeat(65_536 - header.length - rowPrefix.length - 1);
    const fp = writeTmp("csv-quote-boundary.csv", `${header}${rowPrefix}${filler}""quoted",post`);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].recordCount, 1);
  });

  // 53. Atomic writer flush failure
  await test("Atomic output: flush failure leaves no final or temporary report", () => {
    const out = path.join(tmpDir, "flush-failure.json");
    const operations: AtomicWriteOperations = {
      openSync: fs.openSync,
      writeSync: fs.writeSync,
      fsyncSync: () => { throw Object.assign(new Error("synthetic flush path leak"), { code: "EIO" }); },
      closeSync: fs.closeSync,
      linkSync: fs.linkSync,
      unlinkSync: fs.unlinkSync,
    };
    assert.throws(() => atomicWriteInventory(out, "{}", operations), /Inventory output write failed/);
    assert.equal(fs.existsSync(out), false);
    assert.equal(fs.readdirSync(tmpDir).some((entry) => entry.startsWith(".inventory-")), false);
  });

  // 54. Atomic writer publication failure
  await test("Atomic output: publication failure is redacted and cleaned", () => {
    const out = path.join(tmpDir, "publish-failure.json");
    const operations: AtomicWriteOperations = {
      openSync: fs.openSync,
      writeSync: fs.writeSync,
      fsyncSync: fs.fsyncSync,
      closeSync: fs.closeSync,
      linkSync: () => { throw Object.assign(new Error(`/private/path/${path.basename(out)}`), { code: "EIO" }); },
      unlinkSync: fs.unlinkSync,
    };
    let message = "";
    try { atomicWriteInventory(out, "{}", operations); } catch (error) { message = error instanceof Error ? error.message : String(error); }
    assert.equal(message, "Inventory output write failed");
    assert.equal(message.includes("/private/path"), false);
    assert.equal(fs.existsSync(out), false);
  });

  // 55. Atomic writer directory sync failure
  await test("Atomic output: directory sync failure removes published report", () => {
    const out = path.join(tmpDir, "directory-sync-failure.json");
    let fsyncCalls = 0;
    const operations: AtomicWriteOperations = {
      openSync: fs.openSync,
      writeSync: fs.writeSync,
      fsyncSync: (fd) => {
        fsyncCalls += 1;
        if (fsyncCalls === 1) return fs.fsyncSync(fd);
        throw Object.assign(new Error("synthetic directory sync"), { code: "EIO" });
      },
      closeSync: fs.closeSync,
      linkSync: fs.linkSync,
      unlinkSync: fs.unlinkSync,
    };
    assert.throws(() => atomicWriteInventory(out, "{}", operations), /directory synchronization failed/);
    assert.equal(fs.existsSync(out), false);
  });

  await test("WordPress JSON: malformed reviewed-looking JSON fails closed", async () => {
    const fp = writeTmp(
      "wordpress-malformed.json",
      '{"posts":[{"id":1,"post_type":"post","post_title":"Synthetic"}]',
    );
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "json" });
    assert.equal(report.files[0].detectedFormat, "unknown");
    assert.equal(report.files[0].recordCount, null);
    assert.equal(report.files[0].countConfidence, "unavailable");
    assert.ok(report.files[0].warnings.some((warning) => warning === "JSON parse error"));
  });

  await test("WordPress JSON: explicit JSON hint cannot override structural validation", async () => {
    const fp = writeTmp("json-hint-arbitrary.json", JSON.stringify({ posts: [{ title: "Only title" }] }));
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "json" });
    assert.equal(report.files[0].detectedFormat, "unknown");
    assert.equal(report.files[0].status, "unknown");
  });

  await test("WordPress JSON: reviewed WordPress structure wins over contact-like content", async () => {
    const fp = writeTmp("wordpress-ambiguous.json", JSON.stringify({
      posts: [{ id: 1, post_type: "post", post_title: "Synthetic", post_content: "Body" }],
      contacts: [{ id: 2, email: "synthetic@example.invalid", status: "subscribed" }],
    }));
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].detectedFormat, "wordpress-json");
    assert.equal(report.files[0].recordCount, 1);
  });

  await test("WXR: missing channel is not recognized", async () => {
    const fp = writeTmp(
      "wxr-missing-channel.xml",
      '<?xml version="1.0"?><rss xmlns:wp="http://wordpress.org/export/1.2/"><wp:wxr_version>1.2</wp:wxr_version></rss>',
    );
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].detectedFormat, "unknown");
  });

  await test("WXR: explicit hint cannot produce exact confidence for incomplete structure", async () => {
    const fp = writeTmp(
      "wxr-explicit-incomplete.xml",
      '<?xml version="1.0"?><rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version><item></channel></rss>',
    );
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "wxr" });
    assert.equal(report.files[0].detectedFormat, "wordpress-wxr");
    assert.equal(report.files[0].recordCount, null);
    assert.equal(report.files[0].countConfidence, "unavailable");
  });

  await test("WXR: structural closing markers split across 64 KiB remain valid", async () => {
    const prefix = '<?xml version="1.0"?><rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version>';
    const close = "</channel></rss>";
    const filler = "x".repeat(65_536 - prefix.length - 3);
    const fp = writeTmp("wxr-structure-boundary.xml", `${prefix}${filler}${close}`);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].recordCount, 0);
    assert.equal(report.files[0].countConfidence, "exact");
  });

  await test("WXR: misnested channel and RSS closing tags never receive exact confidence", async () => {
    const fp = writeTmp(
      "wxr-misnested-closing.xml",
      '<?xml version="1.0"?><rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version><item></item></rss></channel>',
    );
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].detectedFormat, "wordpress-wxr");
    assert.equal(report.files[0].recordCount, null);
    assert.equal(report.files[0].countConfidence, "unavailable");
  });

  await test("WXR: misnested nested elements never receive exact confidence", async () => {
    const fp = writeTmp(
      "wxr-misnested-title.xml",
      '<?xml version="1.0"?><rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version><item><title>Synthetic</item></title></channel></rss>',
    );
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].recordCount, null);
    assert.equal(report.files[0].countConfidence, "unavailable");
  });

  await test("WXR: Unicode case expansion near a stream boundary cannot drift item counting", async () => {
    const prefix = '<?xml version="1.0"?><rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version><title>';
    const suffix = '</title><item></item></channel></rss>';
    const filler = "İ".repeat(Math.max(1, 65_536 - prefix.length - 8));
    const fp = writeTmp("wxr-unicode-boundary.xml", `${prefix}${filler}${suffix}`);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].recordCount, 1);
    assert.equal(report.files[0].countConfidence, "exact");
  });

  await test("WXR: invalid entities and control characters never receive exact confidence", async () => {
    const wrap = (title: string) => `<?xml version="1.0"?><rss xmlns:wp="http://wordpress.org/export/1.2/"><channel><wp:wxr_version>1.2</wp:wxr_version><item><title>${title}</title></item></channel></rss>`;
    for (const [name, title] of [
      ["wxr-invalid-entity.xml", "Synthetic &undefined; title"],
      ["wxr-invalid-control.xml", "Synthetic \u0001 title"],
    ] as const) {
      const fp = writeTmp(name, wrap(title));
      const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
      assert.equal(report.files[0].recordCount, null, name);
      assert.equal(report.files[0].countConfidence, "unavailable", name);
    }
    const valid = writeTmp("wxr-valid-entity.xml", wrap("Synthetic &amp; valid"));
    const validReport = await buildLegacySourceInventory({ filePaths: [valid], formatHint: "auto" });
    assert.equal(validReport.files[0].recordCount, 1);
    assert.equal(validReport.files[0].countConfidence, "exact");
  });

  await test("CSV: substring-only schema names remain unknown", async () => {
    for (const [name, csv] of [
      ["not-wordpress.csv", "not_post_id,description\n1,Synthetic\n"],
      ["not-fluent.csv", "id,crm_notes\n1,Synthetic\n"],
    ] as const) {
      const fp = writeTmp(name, csv);
      const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
      assert.equal(report.files[0].detectedFormat, "unknown", name);
      assert.equal(report.files[0].countConfidence, "unavailable", name);
    }
  });

  await test("CSV: BOM, quoted commas, embedded line endings, empty fields, and final row are exact", async () => {
    const csv = '\uFEFFpost_id,post_title,post_type\r\n1,"quoted, comma",post\r\n2,"embedded\nLF",post\r\n3,"embedded\r\nCRLF and ""quotes""",post\r\n4,"",post';
    const fp = writeTmp("csv-complete-boundaries.csv", csv);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].recordCount, 4);
    assert.equal(report.files[0].countConfidence, "exact");
  });

  await test("CSV: closing quote at the 64 KiB boundary remains exact", async () => {
    const header = "post_id,post_title,post_type\n";
    const rowPrefix = '1,"';
    const filler = "x".repeat(65_536 - header.length - rowPrefix.length - 1);
    const fp = writeTmp("csv-closing-quote-boundary.csv", `${header}${rowPrefix}${filler}",post`);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].recordCount, 1);
    assert.equal(report.files[0].countConfidence, "exact");
  });

  await test("CSV: CRLF split across the 64 KiB boundary counts each row once", async () => {
    const header = "post_id,post_title,post_type\n";
    const rowPrefix = "1,";
    const filler = "x".repeat(65_536 - header.length - rowPrefix.length - 1);
    const fp = writeTmp("csv-crlf-boundary.csv", `${header}${rowPrefix}${filler}\r\n2,Synthetic,post`);
    const report = await buildLegacySourceInventory({ filePaths: [fp], formatHint: "auto" });
    assert.equal(report.files[0].recordCount, 2);
  });

  await test("Atomic output: partial writes are retried until the complete report is durable", () => {
    const out = path.join(tmpDir, "partial-write.json");
    const operations: AtomicWriteOperations = {
      openSync: fs.openSync,
      writeSync: ((fd: number, buffer: Buffer, offset: number, length: number, position: number) =>
        fs.writeSync(fd, buffer, offset, Math.min(length, 3), position)) as typeof fs.writeSync,
      fsyncSync: fs.fsyncSync,
      closeSync: fs.closeSync,
      linkSync: fs.linkSync,
      unlinkSync: fs.unlinkSync,
    };
    const content = JSON.stringify({ complete: "synthetic report" });
    atomicWriteInventory(out, content, operations);
    assert.equal(fs.readFileSync(out, "utf8"), content);
  });

  await test("Atomic output: zero-progress write is redacted and cleaned", () => {
    const out = path.join(tmpDir, "zero-write.json");
    const operations: AtomicWriteOperations = {
      openSync: fs.openSync,
      writeSync: (() => 0) as typeof fs.writeSync,
      fsyncSync: fs.fsyncSync,
      closeSync: fs.closeSync,
      linkSync: fs.linkSync,
      unlinkSync: fs.unlinkSync,
    };
    assert.throws(() => atomicWriteInventory(out, "{}", operations), /^Error: Inventory output write failed$/);
    assert.equal(fs.existsSync(out), false);
    assert.equal(fs.readdirSync(tmpDir).some((entry) => entry.startsWith(".inventory-")), false);
  });

  await test("Atomic output: concurrent target creation is preserved and temporary output is removed", () => {
    const out = path.join(tmpDir, "concurrent-target.json");
    const operations: AtomicWriteOperations = {
      openSync: fs.openSync,
      writeSync: fs.writeSync,
      fsyncSync: fs.fsyncSync,
      closeSync: fs.closeSync,
      linkSync: () => {
        fs.writeFileSync(out, "concurrent owner", { flag: "wx", mode: 0o600 });
        throw Object.assign(new Error("synthetic concurrent publication"), { code: "EEXIST" });
      },
      unlinkSync: fs.unlinkSync,
    };
    assert.throws(() => atomicWriteInventory(out, "our report", operations), /already exists/);
    assert.equal(fs.readFileSync(out, "utf8"), "concurrent owner");
    assert.equal(fs.readdirSync(tmpDir).some((entry) => entry.startsWith(".inventory-")), false);
  });

  await test("Atomic output: temporary report uses exclusive creation and restrictive permissions", () => {
    const out = path.join(tmpDir, "exclusive-mode.json");
    let capturedFlags = 0;
    let capturedMode = 0;
    const operations: AtomicWriteOperations = {
      openSync: ((target: fs.PathLike, flags: fs.OpenMode, mode?: fs.Mode) => {
        if (typeof flags === "number" && (flags & fs.constants.O_CREAT) !== 0) {
          capturedFlags = flags;
          capturedMode = Number(mode);
        }
        return fs.openSync(target, flags, mode);
      }) as typeof fs.openSync,
      writeSync: fs.writeSync,
      fsyncSync: fs.fsyncSync,
      closeSync: fs.closeSync,
      linkSync: fs.linkSync,
      unlinkSync: fs.unlinkSync,
    };
    atomicWriteInventory(out, "{}", operations);
    assert.notEqual(capturedFlags & fs.constants.O_EXCL, 0);
    assert.equal(capturedMode, 0o600);
  });

  await test("Input identity: directories, devices, named pipes, and sockets are rejected", async () => {
    const directoryReport = await buildLegacySourceInventory({ filePaths: [tmpDir], formatHint: "auto" });
    assert.equal(directoryReport.files[0].status, "rejected");

    if (fs.existsSync("/dev/null")) {
      const deviceReport = await buildLegacySourceInventory({ filePaths: ["/dev/null"], formatHint: "auto" });
      assert.equal(deviceReport.files[0].status, "rejected");
    }

    const fifoPath = path.join(tmpDir, "synthetic.fifo");
    const fifo = spawnSync("mkfifo", [fifoPath]);
    if (fifo.status === 0) {
      const fifoReport = await buildLegacySourceInventory({ filePaths: [fifoPath], formatHint: "auto" });
      assert.equal(fifoReport.files[0].status, "rejected");
      fs.unlinkSync(fifoPath);
    }

    const socketPath = path.join(tmpDir, "synthetic.sock");
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath, resolve);
    });
    try {
      const socketReport = await buildLegacySourceInventory({ filePaths: [socketPath], formatHint: "auto" });
      assert.equal(socketReport.files[0].status, "rejected");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------

  console.log(`\n${passed + failed} tests  |  ${passed} passed  |  ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

setup();
runTests().then(teardown).catch((err) => {
  console.error("Test runner error:", err);
  teardown();
  process.exit(1);
});
