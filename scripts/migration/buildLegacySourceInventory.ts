/**
 * buildLegacySourceInventory.ts
 *
 * Non-mutating source-intake command. Reads external files and produces a
 * PII-safe JSON inventory report. Never uploads, transmits, or mutates any
 * external system. Never logs contact names, emails, phone numbers, addresses,
 * tokens, or content bodies.
 *
 * Usage:
 *   tsx scripts/migration/buildLegacySourceInventory.ts [--format auto] [--out report.json] <file1> [file2 ...]
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupportedFormat =
  | "wordpress-wxr"
  | "wordpress-csv"
  | "fluentcrm-csv"
  | "fluentcrm-json"
  | "fluent-community"
  | "json"
  | "unknown";

export type FileStatus = "accepted" | "rejected" | "unknown";

export type RecordCountConfidence = "exact" | "estimated" | "unavailable";

export interface FileInventory {
  /** Filename only — no directory path */
  path: string;
  bytes: number;
  sha256: string;
  detectedFormat: SupportedFormat | "unsupported";
  /** null when not safely detectable */
  recordCount: number | null;
  countConfidence: RecordCountConfidence;
  warnings: string[];
  status: FileStatus;
}

export interface InventorySummary {
  totalFiles: number;
  accepted: number;
  rejected: number;
  unknown: number;
  warnings: number;
}

export interface InventoryReport {
  inventoryVersion: "1.0";
  generatedAt: string;
  files: FileInventory[];
  summary: InventorySummary;
}

export type FormatHint =
  | "wxr"
  | "csv"
  | "json"
  | "fluent-community"
  | "auto";

export interface InventoryConfig {
  filePaths: string[];
  formatHint: FormatHint;
  outPath?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SNIFF_BUFFER_SIZE = 8192;
const WXR_STRUCTURAL_MARKER = /<rss[^>]*>/i;

// WordPress CSV structural columns — at least one must be present
const WP_CSV_COLUMNS = [
  "post_id",
  "post_title",
  "post_type",
  "post_status",
  "post_name",
  "post_date",
  "menu_order",
];

// ---------------------------------------------------------------------------
// Path redaction helpers
// ---------------------------------------------------------------------------

/**
 * Strip directory paths from a message. Replaces any occurrence of a known
 * full path with just its basename, and replaces home directory prefix with
 * a generic placeholder.
 */
function redactPaths(msg: string, filePath: string): string {
  let result = msg;
  // Replace full path with basename
  if (filePath) {
    result = result.split(filePath).join(path.basename(filePath));
  }
  // Replace home directory prefix
  const home = os.homedir();
  if (home) {
    result = result.split(home).join("<path>");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Streaming SHA-256
// ---------------------------------------------------------------------------

async function sha256Stream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

// ---------------------------------------------------------------------------
// Streaming item counter for WXR
// ---------------------------------------------------------------------------

async function countWxrItems(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    let remainder = "";
    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    stream.on("error", reject);
    stream.on("data", (chunk: string) => {
      const text = remainder + chunk;
      // Count <item> occurrences — use a simple scan to avoid RegExp lastIndex state issues
      let pos = 0;
      while (true) {
        const idx = text.indexOf("<item>", pos);
        if (idx === -1) break;
        count++;
        pos = idx + 6;
      }
      // Keep last few chars to handle splits across chunk boundaries
      remainder = text.slice(-6);
    });
    stream.on("end", () => resolve(count));
  });
}

// ---------------------------------------------------------------------------
// Streaming CSV row counter (handles quoted fields with embedded newlines)
// ---------------------------------------------------------------------------

async function countCsvRows(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let dataRows = 0;
    let headerSeen = false;
    let inQuotedField = false;
    let remainder = "";

    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    stream.on("error", reject);
    stream.on("data", (chunk: string) => {
      const text = remainder + chunk;
      let pos = 0;
      let lineStart = 0;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
          inQuotedField = !inQuotedField;
        } else if (ch === "\n" && !inQuotedField) {
          const line = text.slice(lineStart, i).trim();
          if (line.length > 0) {
            if (!headerSeen) {
              headerSeen = true;
            } else {
              dataRows++;
            }
          }
          lineStart = i + 1;
          pos = lineStart;
        }
      }
      remainder = text.slice(lineStart);
    });
    stream.on("end", () => {
      // Handle last line without trailing newline
      const last = remainder.trim();
      if (last.length > 0) {
        if (!headerSeen) {
          // only header, no data rows
        } else {
          dataRows++;
        }
      }
      resolve(dataRows);
    });
  });
}

// ---------------------------------------------------------------------------
// Bounded sniff buffer reader
// ---------------------------------------------------------------------------

function readSniffBuffer(filePath: string): Buffer {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(SNIFF_BUFFER_SIZE);
    const bytesRead = fs.readSync(fd, buf, 0, SNIFF_BUFFER_SIZE, 0);
    return buf.slice(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Format detection — fail-closed with structural validation
// ---------------------------------------------------------------------------

interface DetectResult {
  format: SupportedFormat | "unsupported";
  warnings: string[];
}

function detectFormat(
  hint: FormatHint,
  filename: string,
  sniff: Buffer
): DetectResult {
  const ext = path.extname(filename).toLowerCase();
  const sniffStr = sniff.toString("utf8").replace(/^﻿/, "");
  const warnings: string[] = [];

  // Check for binary PDF header regardless of hint or extension
  if (sniff.length >= 4 && sniff.slice(0, 4).toString("ascii") === "%PDF") {
    if (hint !== "auto" && (ext === ".csv" || ext === ".json" || ext === ".xml")) {
      warnings.push("Renamed binary detected (PDF header in non-PDF file); rejected as unsupported");
    }
    return { format: "unsupported", warnings };
  }

  // fluent-community: opaque, no structural validation needed
  if (hint === "fluent-community") {
    return { format: "fluent-community", warnings };
  }

  // hint=wxr
  if (hint === "wxr") {
    // Must have <rss> structural marker in sniff buffer or mismatch
    if (!WXR_STRUCTURAL_MARKER.test(sniffStr)) {
      // Check if it looks like CSV (has commas, no XML)
      if (sniffStr.includes(",") && !sniffStr.includes("<")) {
        warnings.push(
          `Format hint mismatch: hint was "wxr" but file "${filename}" appears to be CSV`
        );
        return { format: "unsupported", warnings };
      }
      warnings.push(
        `WXR hint applied but <rss> structural marker not found in "${filename}"; rejecting as unrecognized-wxr`
      );
      return { format: "unsupported", warnings };
    }
    return { format: "wordpress-wxr", warnings };
  }

  // hint=csv
  if (hint === "csv") {
    if (!sniffStr.includes(",")) {
      warnings.push(`CSV hint applied but no comma found in "${filename}"; rejecting`);
      return { format: "unsupported", warnings };
    }
    const firstLine = sniffStr.split("\n")[0] ?? "";
    if (isFluentCrmCsvHeader(firstLine)) return { format: "fluentcrm-csv", warnings };
    if (hasWordPressCsvColumns(firstLine)) return { format: "wordpress-csv", warnings };
    warnings.push(
      `CSV file "${filename}" lacks recognized WordPress or FluentCRM schema columns; classified as unknown`
    );
    return { format: "unknown", warnings };
  }

  // hint=json
  if (hint === "json") {
    const trimmed = sniffStr.trimStart();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      warnings.push(`JSON hint applied but content does not start with { or [ in "${filename}"; rejecting`);
      return { format: "unsupported", warnings };
    }
    if (isFluentCrmJsonSniff(sniffStr)) return { format: "fluentcrm-json", warnings };
    return { format: "json", warnings };
  }

  // Auto detection
  if (ext === ".xml") {
    if (WXR_STRUCTURAL_MARKER.test(sniffStr)) {
      return { format: "wordpress-wxr", warnings };
    }
    return { format: "unsupported", warnings };
  }

  if (ext === ".csv") {
    if (!sniffStr.includes(",")) {
      warnings.push(`CSV file "${filename}" has no commas; classified as unknown`);
      return { format: "unknown", warnings };
    }
    const firstLine = sniffStr.split("\n")[0] ?? "";
    if (isFluentCrmCsvHeader(firstLine)) return { format: "fluentcrm-csv", warnings };
    if (hasWordPressCsvColumns(firstLine)) return { format: "wordpress-csv", warnings };
    warnings.push(
      `CSV file "${filename}" lacks recognized WordPress or FluentCRM schema columns; classified as unknown`
    );
    return { format: "unknown", warnings };
  }

  if (ext === ".json") {
    const trimmed = sniffStr.trimStart();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return { format: "unsupported", warnings };
    }
    if (isFluentCrmJsonSniff(sniffStr)) return { format: "fluentcrm-json", warnings };
    return { format: "json", warnings };
  }

  return { format: "unsupported", warnings };
}

function isFluentCrmCsvHeader(headerLine: string): boolean {
  const lower = headerLine.toLowerCase();
  return (
    lower.includes("contact_status") ||
    lower.includes("subscriber_status") ||
    lower.includes("crm_")
  );
}

function hasWordPressCsvColumns(headerLine: string): boolean {
  const lower = headerLine.toLowerCase();
  return WP_CSV_COLUMNS.some((col) => lower.includes(col));
}

function isFluentCrmJsonSniff(snippet: string): boolean {
  return /"contacts"\s*:/.test(snippet) || /"subscribers"\s*:/.test(snippet);
}

// ---------------------------------------------------------------------------
// Record counting — async, streaming where possible
// ---------------------------------------------------------------------------

interface CountResult {
  recordCount: number | null;
  countConfidence: RecordCountConfidence;
  warnings: string[];
}

async function countRecords(
  format: SupportedFormat | "unsupported",
  filePath: string
): Promise<CountResult> {
  switch (format) {
    case "wordpress-wxr": {
      const count = await countWxrItems(filePath);
      return { recordCount: count, countConfidence: "exact", warnings: [] };
    }

    case "wordpress-csv":
    case "fluentcrm-csv": {
      const count = await countCsvRows(filePath);
      return { recordCount: count, countConfidence: "exact", warnings: [] };
    }

    case "fluentcrm-json": {
      // FluentCRM JSON is expected to be moderate size; parse minimally
      // We only use the sniff buffer to check, but we need to parse for count.
      // Safe: FluentCRM exports are typically not massive. We parse only to get array length.
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const parsed: unknown = JSON.parse(content);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          const obj = parsed as Record<string, unknown>;
          const arr = obj["contacts"] ?? obj["subscribers"];
          if (Array.isArray(arr)) {
            return { recordCount: arr.length, countConfidence: "exact", warnings: [] };
          }
        }
        if (Array.isArray(parsed)) {
          return { recordCount: (parsed as unknown[]).length, countConfidence: "exact", warnings: [] };
        }
        return {
          recordCount: null,
          countConfidence: "unavailable",
          warnings: ["Could not locate contacts or subscribers array in JSON"],
        };
      } catch {
        return { recordCount: null, countConfidence: "unavailable", warnings: ["JSON parse error"] };
      }
    }

    case "json": {
      // For plain JSON: if it's an array, we can count. If it's a large object, skip.
      // Use sniff to decide whether to attempt parse.
      const stat = fs.statSync(filePath);
      const sniff = readSniffBuffer(filePath);
      const sniffStr = sniff.toString("utf8").trimStart();

      if (sniffStr.startsWith("[")) {
        // Top-level array — parse to count
        try {
          const content = fs.readFileSync(filePath, "utf8");
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            return { recordCount: (parsed as unknown[]).length, countConfidence: "exact", warnings: [] };
          }
        } catch {
          return { recordCount: null, countConfidence: "unavailable", warnings: ["JSON parse error"] };
        }
      }

      // Top-level object — do not parse into memory
      return {
        recordCount: null,
        countConfidence: "unavailable",
        warnings: [
          `Large JSON object (${stat.size} bytes): record count unavailable to avoid loading entire file into memory`,
        ],
      };
    }

    case "fluent-community":
      return { recordCount: null, countConfidence: "unavailable", warnings: [] };

    default:
      return { recordCount: null, countConfidence: "unavailable", warnings: [] };
  }
}

// ---------------------------------------------------------------------------
// Output path safety
// ---------------------------------------------------------------------------

function validateOutputPath(outPath: string, inputPaths: string[]): void {
  const resolvedOut = path.resolve(outPath);
  for (const ip of inputPaths) {
    if (path.resolve(ip) === resolvedOut) {
      throw new Error(
        `Output path "${path.basename(outPath)}" overlaps with input path "${path.basename(ip)}"; aborting to prevent data loss`
      );
    }
  }
  if (fs.existsSync(outPath)) {
    throw new Error(
      `Output file "${path.basename(outPath)}" already exists; refusing to overwrite`
    );
  }
}

function atomicWrite(outPath: string, json: string): void {
  const tmpPath = outPath + ".tmp";
  try {
    fs.writeFileSync(tmpPath, json, "utf8");
    fs.renameSync(tmpPath, outPath);
  } catch (err) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Single-file processing (async)
// ---------------------------------------------------------------------------

async function processFile(
  filePath: string,
  hint: FormatHint
): Promise<FileInventory> {
  const filename = path.basename(filePath);
  const warnings: string[] = [];

  // Check file exists and get size
  let bytes = 0;
  try {
    const stat = fs.statSync(filePath);
    bytes = stat.size;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      path: filename,
      bytes: 0,
      sha256: "",
      detectedFormat: "unknown" as SupportedFormat,
      recordCount: null,
      countConfidence: "unavailable",
      warnings: [`Read error: ${redactPaths(msg, filePath)}`],
      status: "rejected",
    };
  }

  if (bytes === 0) {
    warnings.push("File is empty");
  }

  // Streaming SHA-256
  let checksum = "";
  try {
    checksum = await sha256Stream(filePath);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      path: filename,
      bytes,
      sha256: "",
      detectedFormat: "unknown" as SupportedFormat,
      recordCount: null,
      countConfidence: "unavailable",
      warnings: [`Checksum error: ${redactPaths(msg, filePath)}`],
      status: "rejected",
    };
  }

  // Bounded sniff buffer for format detection
  let sniff: Buffer;
  try {
    sniff = bytes > 0 ? readSniffBuffer(filePath) : Buffer.alloc(0);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      path: filename,
      bytes,
      sha256: checksum,
      detectedFormat: "unknown" as SupportedFormat,
      recordCount: null,
      countConfidence: "unavailable",
      warnings: [`Sniff read error: ${redactPaths(msg, filePath)}`],
      status: "rejected",
    };
  }

  const { format: detectedFormat, warnings: detectWarnings } = detectFormat(hint, filename, sniff);
  warnings.push(...detectWarnings);

  if (detectedFormat === "unsupported") {
    return {
      path: filename,
      bytes,
      sha256: checksum,
      detectedFormat: "unsupported",
      recordCount: null,
      countConfidence: "unavailable",
      warnings: warnings.length > 0
        ? warnings
        : [`Unsupported format: extension "${path.extname(filename)}" with hint "${hint}" is not a recognised input format`],
      status: "rejected",
    };
  }

  if (detectedFormat === "unknown") {
    return {
      path: filename,
      bytes,
      sha256: checksum,
      detectedFormat: "unknown",
      recordCount: null,
      countConfidence: "unavailable",
      warnings,
      status: "unknown",
    };
  }

  // Streaming record count
  const { recordCount, countConfidence, warnings: countWarnings } = await countRecords(
    detectedFormat,
    filePath
  );
  warnings.push(...countWarnings);

  if (recordCount === 0) {
    warnings.push("No records detected");
  }

  return {
    path: filename,
    bytes,
    sha256: checksum,
    detectedFormat,
    recordCount,
    countConfidence,
    warnings,
    status: warnings.length > 0 ? "unknown" : "accepted",
  };
}

// ---------------------------------------------------------------------------
// Main exported function (async)
// ---------------------------------------------------------------------------

export async function buildLegacySourceInventory(
  config: InventoryConfig
): Promise<InventoryReport> {
  if (config.filePaths.length === 0) {
    throw new Error("No file paths provided");
  }

  if (config.outPath) {
    validateOutputPath(config.outPath, config.filePaths);
  }

  const files: FileInventory[] = await Promise.all(
    config.filePaths.map((fp) => processFile(fp, config.formatHint))
  );

  const accepted = files.filter((f) => f.status === "accepted").length;
  const rejected = files.filter((f) => f.status === "rejected").length;
  const unknown = files.filter((f) => f.status === "unknown").length;
  const totalWarnings = files.reduce((sum, f) => sum + f.warnings.length, 0);

  const report: InventoryReport = {
    inventoryVersion: "1.0",
    generatedAt: new Date().toISOString(),
    files,
    summary: {
      totalFiles: files.length,
      accepted,
      rejected,
      unknown,
      warnings: totalWarnings,
    },
  };

  if (config.outPath) {
    const json = JSON.stringify(report, null, 2);
    atomicWrite(config.outPath, json);
  }

  return report;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    process.stderr.write(
      [
        "Usage: tsx buildLegacySourceInventory.ts [--format <hint>] [--out <path>] <file1> [file2 ...]",
        "",
        "Options:",
        "  --format  wxr|csv|json|fluent-community|auto  (default: auto)",
        "  --out     Write JSON report to file path instead of stdout",
        "",
        "Formats supported:",
        "  WordPress WXR (.xml)",
        "  WordPress CSV/JSON exports",
        "  FluentCRM CSV/JSON exports",
        "  Fluent Community (opaque — byte/checksum only)",
        "",
      ].join("\n")
    );
    process.exit(0);
  }

  let formatHint: FormatHint = "auto";
  let outPath: string | undefined;
  const filePaths: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && i + 1 < args.length) {
      const raw = args[++i];
      const validHints: FormatHint[] = [
        "wxr",
        "csv",
        "json",
        "fluent-community",
        "auto",
      ];
      if (!validHints.includes(raw as FormatHint)) {
        process.stderr.write(
          `Error: unknown --format value "${raw}". Valid values: ${validHints.join(", ")}\n`
        );
        process.exit(1);
      }
      formatHint = raw as FormatHint;
    } else if (args[i] === "--out" && i + 1 < args.length) {
      outPath = args[++i];
    } else if (!args[i].startsWith("--")) {
      filePaths.push(args[i]);
    } else {
      process.stderr.write(`Error: unknown flag "${args[i]}"\n`);
      process.exit(1);
    }
  }

  if (filePaths.length === 0) {
    process.stderr.write("Error: at least one file path is required\n");
    process.exit(1);
  }

  buildLegacySourceInventory({ filePaths, formatHint, outPath })
    .then((report) => {
      if (!outPath) {
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      } else {
        process.stdout.write(
          `Inventory written to ${path.basename(outPath)} (${report.summary.totalFiles} file(s))\n`
        );
      }
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    });
}
