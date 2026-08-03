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
    let carry = "";
    const TOKEN = "<item>";
    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    stream.on("error", reject);
    stream.on("data", (chunk: string) => {
      const text = carry + chunk;
      let pos = 0;
      while (true) {
        const idx = text.indexOf(TOKEN, pos);
        if (idx === -1) break;
        count++;
        pos = idx + TOKEN.length;
      }
      const remainder = text.slice(pos);
      carry = remainder.length <= TOKEN.length - 1
        ? remainder
        : remainder.slice(remainder.length - (TOKEN.length - 1));
    });
    stream.on("end", () => resolve(count));
  });
}

// ---------------------------------------------------------------------------
// Streaming CSV row counter (handles quoted fields with embedded newlines)
// ---------------------------------------------------------------------------

interface CsvCountResult {
  rows: number;
  malformed: boolean;
}

async function countCsvRows(filePath: string): Promise<CsvCountResult> {
  return new Promise((resolve, reject) => {
    let dataRows = 0;
    let headerSeen = false;
    let inQuote = false;
    let prevCharWasQuote = false;
    let prevCharWasCR = false;
    let currentRowHasContent = false;
    let bomChecked = false;

    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    stream.on("error", reject);
    stream.on("data", (chunk: string) => {
      let start = 0;
      if (!bomChecked) {
        bomChecked = true;
        if (chunk.charCodeAt(0) === 0xFEFF) start = 1;
      }

      for (let i = start; i < chunk.length; i++) {
        const ch = chunk[i];

        if (inQuote) {
          if (ch === '"') {
            if (prevCharWasQuote) {
              prevCharWasQuote = false;
            } else {
              prevCharWasQuote = true;
            }
          } else {
            if (prevCharWasQuote) {
              inQuote = false;
              prevCharWasQuote = false;
              // ch is outside quote — fall through to process it below
            } else {
              // inside quoted field — ignore all chars including newlines
              continue;
            }
          }
          if (inQuote) continue;
        }

        // Outside quote
        if (ch === '"') {
          inQuote = true;
          prevCharWasQuote = false;
          currentRowHasContent = true;
          prevCharWasCR = false;
        } else if (ch === '\n') {
          if (prevCharWasCR) {
            prevCharWasCR = false;
            continue;
          }
          if (currentRowHasContent) {
            if (!headerSeen) { headerSeen = true; }
            else { dataRows++; }
          }
          currentRowHasContent = false;
          prevCharWasCR = false;
        } else if (ch === '\r') {
          if (currentRowHasContent) {
            if (!headerSeen) { headerSeen = true; }
            else { dataRows++; }
          }
          currentRowHasContent = false;
          prevCharWasCR = true;
        } else {
          currentRowHasContent = true;
          prevCharWasCR = false;
        }
      }
    });
    stream.on("end", () => {
      if (prevCharWasQuote) {
        inQuote = false;
        prevCharWasQuote = false;
      }
      if (inQuote) {
        resolve({ rows: dataRows, malformed: true });
        return;
      }
      if (currentRowHasContent) {
        if (!headerSeen) { /* only header, no data */ }
        else { dataRows++; }
      }
      resolve({ rows: dataRows, malformed: false });
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
    if (isWordPressJsonSniff(sniffStr)) return { format: "fluentcrm-json", warnings };
    warnings.push(
      `JSON file "${filename}" lacks recognized WordPress or FluentCRM schema markers; classified as unknown`
    );
    return { format: "unknown", warnings };
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
    if (isWordPressJsonSniff(sniffStr)) return { format: "fluentcrm-json", warnings };
    warnings.push(
      `JSON file "${filename}" lacks recognized WordPress or FluentCRM schema markers; classified as unknown`
    );
    return { format: "unknown", warnings };
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

function isWordPressJsonSniff(snippet: string): boolean {
  return /"wp_post"\s*:/.test(snippet) || /"post_type"\s*:/.test(snippet) && /"post_title"\s*:/.test(snippet);
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
      const result = await countCsvRows(filePath);
      if (result.malformed) {
        return {
          recordCount: null,
          countConfidence: "unavailable",
          warnings: ["Malformed CSV: unterminated quoted field at end of file"],
        };
      }
      return { recordCount: result.rows, countConfidence: "exact", warnings: [] };
    }

    case "fluentcrm-json": {
      const MAX_BOUNDED_JSON_SIZE = 50 * 1024 * 1024; // 50 MiB
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_BOUNDED_JSON_SIZE) {
        return {
          recordCount: null,
          countConfidence: "unavailable",
          warnings: [
            `FluentCRM JSON exceeds bounded parse limit (${stat.size} bytes): streaming parser required for exact count`,
          ],
        };
      }
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

    case "fluent-community":
      return { recordCount: null, countConfidence: "unavailable", warnings: [] };

    default:
      return { recordCount: null, countConfidence: "unavailable", warnings: [] };
  }
}

// ---------------------------------------------------------------------------
// Output path safety
// ---------------------------------------------------------------------------

function canonicalizePath(p: string): string {
  const resolved = path.resolve(p);
  try {
    return fs.realpathSync(resolved);
  } catch {
    // Path doesn't exist yet — canonicalize the parent
    const dir = path.dirname(resolved);
    try {
      return path.join(fs.realpathSync(dir), path.basename(resolved));
    } catch {
      return resolved;
    }
  }
}

function validateOutputPath(outPath: string, inputPaths: string[]): void {
  const canonicalOut = canonicalizePath(outPath);
  for (const ip of inputPaths) {
    const canonicalIn = canonicalizePath(ip);
    if (canonicalIn === canonicalOut) {
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
  const dir = path.dirname(path.resolve(outPath));
  const uniqueSuffix = crypto.randomBytes(8).toString("hex");
  const tmpPath = path.join(dir, `.inv-tmp-${uniqueSuffix}.json`);
  let fd: number | null = null;
  try {
    fd = fs.openSync(tmpPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
    fs.writeSync(fd, json, 0, "utf8");
    try { fs.fsyncSync(fd); } catch { /* best effort */ }
    fs.closeSync(fd);
    fd = null;
    try {
      fs.linkSync(tmpPath, outPath);
    } catch (linkErr: unknown) {
      const code = (linkErr as NodeJS.ErrnoException).code;
      if (code === "EEXIST") {
        throw new Error(
          `Output file "${path.basename(outPath)}" already exists; refusing to overwrite`
        );
      }
      if (code === "EXDEV") {
        fs.renameSync(tmpPath, outPath);
        return;
      }
      throw linkErr;
    }
    fs.unlinkSync(tmpPath);
  } catch (err) {
    if (fd !== null) { try { fs.closeSync(fd); } catch { /**/ } }
    try { fs.unlinkSync(tmpPath); } catch { /**/ }
    if (err instanceof Error && !err.message.includes(path.basename(outPath))) {
      throw new Error(redactPaths(err.message, outPath));
    }
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

  // Check file exists, verify it's a regular file, and get size
  let bytes = 0;
  try {
    const lstat = fs.lstatSync(filePath);
    if (lstat.isSymbolicLink()) {
      return {
        path: filename,
        bytes: 0,
        sha256: "",
        detectedFormat: "unknown" as SupportedFormat,
        recordCount: null,
        countConfidence: "unavailable",
        warnings: ["Symbolic link inputs are not accepted; canonicalize the path first"],
        status: "rejected",
      };
    }
    if (lstat.isDirectory()) {
      return {
        path: filename,
        bytes: 0,
        sha256: "",
        detectedFormat: "unknown" as SupportedFormat,
        recordCount: null,
        countConfidence: "unavailable",
        warnings: ["Input is a directory, not a regular file"],
        status: "rejected",
      };
    }
    if (!lstat.isFile()) {
      return {
        path: filename,
        bytes: 0,
        sha256: "",
        detectedFormat: "unknown" as SupportedFormat,
        recordCount: null,
        countConfidence: "unavailable",
        warnings: ["Input is not a regular file"],
        status: "rejected",
      };
    }
    bytes = lstat.size;
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
      // Exit 0 only when every input is accepted
      const allAccepted = report.files.every((f) => f.status === "accepted");
      process.exit(allAccepted ? 0 : 2);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${msg}\n`);
      process.exit(1);
    });
}
