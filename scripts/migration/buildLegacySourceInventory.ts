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

export interface FileInventory {
  /** Filename only — no directory path */
  path: string;
  bytes: number;
  sha256: string;
  detectedFormat: SupportedFormat | "unsupported";
  /** null when not safely detectable */
  recordCount: number | null;
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
// Format detection helpers (structural markers only — no PII)
// ---------------------------------------------------------------------------

const WXR_STRUCTURAL_MARKER = /<rss[^>]*>/i;
const WXR_ITEM_TAG = /<item>/gi;

function detectFormat(
  hint: FormatHint,
  filename: string,
  content: string
): SupportedFormat | "unsupported" {
  const ext = path.extname(filename).toLowerCase();

  if (hint === "fluent-community") return "fluent-community";

  // Hint: wxr
  if (hint === "wxr") {
    if (ext === ".xml") return "wordpress-wxr";
    return "wordpress-wxr"; // trust the hint
  }

  // Hint: csv
  if (hint === "csv") {
    // Distinguish WordPress CSV vs FluentCRM CSV by header structure.
    // We only look at the first line (header row) for structural column names —
    // these are schema markers, not PII values.
    const firstLine = content.slice(0, 2048).split("\n")[0] ?? "";
    if (isFluentCrmCsvHeader(firstLine)) return "fluentcrm-csv";
    return "wordpress-csv";
  }

  // Hint: json
  if (hint === "json") {
    const firstLine = content.slice(0, 4096);
    if (isFluentCrmJson(firstLine)) return "fluentcrm-json";
    return "json";
  }

  // Auto detection
  if (ext === ".xml") {
    if (WXR_STRUCTURAL_MARKER.test(content.slice(0, 4096))) {
      return "wordpress-wxr";
    }
    return "unsupported";
  }

  if (ext === ".csv") {
    const firstLine = content.slice(0, 2048).split("\n")[0] ?? "";
    if (isFluentCrmCsvHeader(firstLine)) return "fluentcrm-csv";
    return "wordpress-csv";
  }

  if (ext === ".json") {
    const firstLine = content.slice(0, 4096);
    if (isFluentCrmJson(firstLine)) return "fluentcrm-json";
    return "json";
  }

  return "unsupported";
}

/**
 * Detect FluentCRM CSV by checking header column names. These are schema
 * identifiers, not PII. We only look at the header row, never at data rows.
 */
function isFluentCrmCsvHeader(headerLine: string): boolean {
  const lower = headerLine.toLowerCase();
  // FluentCRM exports typically carry these structural column names
  return (
    lower.includes("contact_status") ||
    lower.includes("subscriber_status") ||
    lower.includes("crm_")
  );
}

/**
 * Detect FluentCRM JSON by structural shape: object with a "contacts" key or
 * a "subscribers" key at the top level. We only look at key names, not values.
 */
function isFluentCrmJson(snippet: string): boolean {
  return /"contacts"\s*:/.test(snippet) || /"subscribers"\s*:/.test(snippet);
}

// ---------------------------------------------------------------------------
// Record count detection (PII-safe — counts only, no values read)
// ---------------------------------------------------------------------------

function countRecords(
  format: SupportedFormat | "unsupported",
  content: string
): number | null {
  switch (format) {
    case "wordpress-wxr": {
      // Count <item> elements by structural tag matching only
      const matches = content.match(WXR_ITEM_TAG);
      return matches ? matches.length : 0;
    }

    case "wordpress-csv":
    case "fluentcrm-csv": {
      // Count lines minus header; never read cell values
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      return Math.max(0, lines.length - 1);
    }

    case "fluentcrm-json": {
      // Top-level object with contacts/subscribers array — count array elements
      // We parse minimally; if parse fails return null (safe fallback)
      try {
        const parsed: unknown = JSON.parse(content);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          const obj = parsed as Record<string, unknown>;
          const arr = obj["contacts"] ?? obj["subscribers"];
          if (Array.isArray(arr)) return arr.length;
        }
        if (Array.isArray(parsed)) return parsed.length;
        return null;
      } catch {
        return null;
      }
    }

    case "json": {
      // Count array elements if top-level is array
      try {
        const parsed: unknown = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed.length;
        return null;
      } catch {
        return null;
      }
    }

    case "fluent-community":
      // Opaque — do not parse
      return null;

    case "unsupported":
      return null;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// SHA-256 checksum
// ---------------------------------------------------------------------------

function sha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// ---------------------------------------------------------------------------
// Single-file processing
// ---------------------------------------------------------------------------

function processFile(
  filePath: string,
  hint: FormatHint
): FileInventory {
  const filename = path.basename(filePath); // never log directory paths
  const warnings: string[] = [];

  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Unknown read error";
    // Sanitize: do not include the full path in the error message
    return {
      path: filename,
      bytes: 0,
      sha256: "",
      detectedFormat: "unknown" as SupportedFormat,
      recordCount: null,
      warnings: [`Read error: ${sanitizeErrorMessage(msg, filePath)}`],
      status: "rejected",
    };
  }

  const bytes = buffer.length;
  const checksum = sha256Hex(buffer);

  if (bytes === 0) {
    warnings.push("File is empty");
  }

  // Decode to string for format detection (UTF-8; ignore BOM)
  let content = "";
  try {
    content = buffer.toString("utf8").replace(/^﻿/, "");
  } catch {
    warnings.push("Could not decode file as UTF-8");
  }

  const detectedFormat = detectFormat(hint, filename, content);

  if (detectedFormat === "unsupported") {
    return {
      path: filename,
      bytes,
      sha256: checksum,
      detectedFormat: "unsupported",
      recordCount: null,
      warnings: [`Unsupported format: extension "${path.extname(filename)}" with hint "${hint}" is not a recognised input format`],
      status: "rejected",
    };
  }

  const recordCount = countRecords(detectedFormat, content);

  if (recordCount === 0) {
    warnings.push("No records detected");
  }

  return {
    path: filename,
    bytes,
    sha256: checksum,
    detectedFormat,
    recordCount,
    warnings,
    status: warnings.length > 0 ? "unknown" : "accepted",
  };
}

/**
 * Strip directory path from error messages to avoid leaking filesystem layout.
 */
function sanitizeErrorMessage(msg: string, filePath: string): string {
  // Replace occurrences of the full path with the filename only
  return msg.replace(filePath, path.basename(filePath));
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export function buildLegacySourceInventory(
  config: InventoryConfig
): InventoryReport {
  if (config.filePaths.length === 0) {
    throw new Error("No file paths provided");
  }

  const files: FileInventory[] = config.filePaths.map((fp) =>
    processFile(fp, config.formatHint)
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

  let report: InventoryReport;
  try {
    report = buildLegacySourceInventory({ filePaths, formatHint, outPath });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${msg}\n`);
    process.exit(1);
  }

  const json = JSON.stringify(report, null, 2);

  if (outPath) {
    try {
      fs.writeFileSync(outPath, json, "utf8");
      process.stdout.write(
        `Inventory written to ${path.basename(outPath)} (${report.summary.totalFiles} file(s))\n`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error writing output file: ${msg}\n`);
      process.exit(1);
    }
  } else {
    process.stdout.write(json + "\n");
  }
}
