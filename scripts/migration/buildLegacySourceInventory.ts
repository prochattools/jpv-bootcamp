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
  | "wordpress-json"
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
const JSON_PARSE_LIMIT_BYTES = 5 * 1024 * 1024;
const WXR_NAMESPACE_MARKER = /xmlns:wp\s*=\s*["']http:\/\/wordpress\.org\/export\/[^"']+["']/i;
const WXR_VERSION_MARKER = /<wp:wxr_version(?:\s[^>]*)?>/i;
const WXR_RSS_MARKER = /<rss(?:\s[^>]*)?>/i;
const WXR_CHANNEL_MARKER = /<channel(?:\s[^>]*)?>/i;

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

function createInputStream(
  filePath: string,
  fd: number,
  encoding?: BufferEncoding,
): fs.ReadStream {
  return fs.createReadStream(filePath, {
    fd,
    autoClose: false,
    start: 0,
    ...(encoding ? { encoding } : {}),
  });
}

async function sha256Stream(filePath: string, fd: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createInputStream(filePath, fd);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

// ---------------------------------------------------------------------------
// Streaming item counter for WXR
// ---------------------------------------------------------------------------

async function countWxrItems(filePath: string, fd: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    let carry = "";
    const TOKEN = "<item>";
    const stream = createInputStream(filePath, fd, "utf8");
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

interface WxrAnalysis {
  itemCount: number;
  structurallyValid: boolean;
}

function isAllowedXmlCodePoint(codePoint: number): boolean {
  return codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function isValidXmlEntity(entity: string): boolean {
  if (/^&(amp|lt|gt|apos|quot);$/.test(entity)) return true;
  const decimal = entity.match(/^&#([0-9]+);$/);
  const hexadecimal = entity.match(/^&#x([0-9A-Fa-f]+);$/);
  if (!decimal && !hexadecimal) return false;
  const codePoint = Number.parseInt(decimal?.[1] ?? hexadecimal?.[1] ?? "", decimal ? 10 : 16);
  return Number.isInteger(codePoint) && isAllowedXmlCodePoint(codePoint);
}

function hasValidXmlCharactersAndEntities(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || !isAllowedXmlCodePoint(codePoint)) return false;
  }
  const entities = value.match(/&[^;]*;/g) ?? [];
  if (entities.some((entity) => !isValidXmlEntity(entity))) return false;
  return value.replace(/&[^;]*;/g, "").includes("&") === false;
}

async function analyzeWxr(filePath: string, fd: number): Promise<WxrAnalysis> {
  return new Promise((resolve, reject) => {
    let itemCount = 0;
    let invalid = false;
    let mode: "text" | "tag" | "comment" | "cdata" | "processing" = "text";
    let token = "";
    let terminatorTail = "";
    let quote: "\"" | "'" | null = null;
    let textEntity: string | null = null;
    const elementStack: string[] = [];
    let rootClosed = false;
    const structural = {
      rssOpen: false,
      rssClose: false,
      channelOpen: false,
      channelClose: false,
      namespace: false,
      version: false,
      versionClose: false,
    };

    const processTag = (rawToken: string): void => {
      if (rawToken.startsWith("<!")) {
        invalid = true;
        return;
      }

      const closing = rawToken.match(/^<\/([A-Za-z_][A-Za-z0-9_.:-]*)\s*>$/);
      if (closing) {
        const name = closing[1].toLowerCase();
        if (elementStack.at(-1) !== name) invalid = true;
        else elementStack.pop();

        if (name === "wp:wxr_version") {
          if (!structural.version || structural.versionClose) invalid = true;
          structural.versionClose = true;
        } else if (name === "item") {
          if (!structural.channelOpen || structural.channelClose) invalid = true;
        } else if (name === "channel") {
          if (!structural.channelOpen || structural.channelClose || !structural.versionClose) invalid = true;
          structural.channelClose = true;
        } else if (name === "rss") {
          if (!structural.rssOpen || structural.rssClose || !structural.channelClose) invalid = true;
          structural.rssClose = true;
          rootClosed = true;
        }
        return;
      }

      const opening = rawToken.match(/^<([A-Za-z_][A-Za-z0-9_.:-]*)([\s\S]*?)(\/?)>$/);
      if (!opening) {
        invalid = true;
        return;
      }
      const name = opening[1].toLowerCase();
      const attributes = opening[2];
      const selfClosing = opening[3] === "/";
      const attributeNames = new Set<string>();
      let remainder = attributes;
      while (remainder.length > 0) {
        if (/^\s*$/.test(remainder)) break;
        const attribute = remainder.match(/^\s+([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("[^"]*"|'[^']*')/);
        if (!attribute) {
          invalid = true;
          break;
        }
        const attributeName = attribute[1].toLowerCase();
        if (attributeNames.has(attributeName)) invalid = true;
        attributeNames.add(attributeName);
        if (!hasValidXmlCharactersAndEntities(attribute[2].slice(1, -1))) invalid = true;
        remainder = remainder.slice(attribute[0].length);
      }

      if (elementStack.length === 0) {
        if (rootClosed || name !== "rss") invalid = true;
      }
      const parent = elementStack.at(-1);
      if (name === "rss") {
        if (structural.rssOpen || selfClosing) invalid = true;
        structural.rssOpen = true;
        structural.namespace = /\sxmlns:wp\s*=\s*["']http:\/\/wordpress\.org\/export\/[^"']+["']/i.test(rawToken);
      } else if (name === "channel") {
        if (parent !== "rss" || structural.channelOpen || selfClosing) invalid = true;
        structural.channelOpen = true;
      } else if (name === "wp:wxr_version") {
        if (parent !== "channel" || structural.version || selfClosing) invalid = true;
        structural.version = true;
      } else if (name === "item") {
        if (parent !== "channel" || !structural.versionClose || structural.channelClose || selfClosing) invalid = true;
        itemCount += 1;
      }

      if (!selfClosing) elementStack.push(name);
    };

    const stream = createInputStream(filePath, fd, "utf8");
    stream.on("error", reject);
    stream.on("data", (chunk: string) => {
      for (const character of chunk) {
        if (mode === "comment" || mode === "cdata" || mode === "processing") {
          const codePoint = character.codePointAt(0);
          if (codePoint === undefined || !isAllowedXmlCodePoint(codePoint)) invalid = true;
          terminatorTail = `${terminatorTail}${character}`.slice(-3);
          const complete = mode === "comment"
            ? terminatorTail.endsWith("-->")
            : mode === "cdata"
              ? terminatorTail.endsWith("]]>")
              : terminatorTail.endsWith("?>");
          if (complete) {
            mode = "text";
            terminatorTail = "";
          }
          continue;
        }

        if (mode === "text") {
          if (character === "<") {
            if (textEntity !== null) {
              invalid = true;
              textEntity = null;
            }
            mode = "tag";
            token = "<";
            quote = null;
          } else {
            const codePoint = character.codePointAt(0);
            if (codePoint === undefined || !isAllowedXmlCodePoint(codePoint)) invalid = true;
            if (elementStack.length === 0 && character.trim() !== "") invalid = true;
            if (textEntity !== null) {
              textEntity += character;
              if (character === ";") {
                if (!isValidXmlEntity(textEntity)) invalid = true;
                textEntity = null;
              } else if (character.trim() === "" || textEntity.length > 32) {
                invalid = true;
                textEntity = null;
              }
            } else if (character === "&") {
              textEntity = "&";
            }
          }
          continue;
        }

        token += character;
        if (token === "<?") {
          mode = "processing";
          token = "";
          continue;
        }
        if (token === "<!--") {
          mode = "comment";
          token = "";
          continue;
        }
        if (token === "<![CDATA[") {
          if (elementStack.length === 0) invalid = true;
          mode = "cdata";
          token = "";
          continue;
        }
        if (token.length > 65_536) {
          invalid = true;
          mode = "text";
          token = "";
          continue;
        }
        if ((character === "\"" || character === "'") && (!quote || quote === character)) {
          quote = quote === character ? null : character;
        } else if (character === ">" && quote === null) {
          processTag(token);
          mode = "text";
          token = "";
        }
      }
    });
    stream.on("end", () => {
      resolve({
        itemCount,
        structurallyValid: Object.values(structural).every(Boolean) && elementStack.length === 0 && mode === "text" && textEntity === null && !invalid,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Streaming CSV row counter (handles quoted fields with embedded newlines)
// ---------------------------------------------------------------------------

interface CsvCountResult {
  rows: number;
  malformed: boolean;
}

async function countCsvRows(filePath: string, fd: number): Promise<CsvCountResult> {
  return new Promise((resolve, reject) => {
    let dataRows = 0;
    let headerSeen = false;
    let inQuote = false;
    let prevCharWasQuote = false;
    let prevCharWasCR = false;
    let currentRowHasContent = false;
    let bomChecked = false;

    const stream = createInputStream(filePath, fd, "utf8");
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

function readSniffBuffer(fd: number): Buffer {
  const buf = Buffer.alloc(SNIFF_BUFFER_SIZE);
  const bytesRead = fs.readSync(fd, buf, 0, SNIFF_BUFFER_SIZE, 0);
  return buf.slice(0, bytesRead);
}

function readBoundedUtf8(fd: number, bytes: number): string {
  const buffer = Buffer.alloc(bytes);
  let read = 0;
  while (read < bytes) {
    const bytesRead = fs.readSync(fd, buffer, read, bytes - read, read);
    if (bytesRead === 0) break;
    read += bytesRead;
  }
  return buffer.subarray(0, read).toString("utf8");
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
    if (!isWordPressWxrSniff(sniffStr)) {
      warnings.push(
        `WXR hint applied but WordPress export namespace/version markers were not found in "${filename}"`
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
    if (isWordPressJsonSniff(sniffStr)) return { format: "wordpress-json", warnings };
    if (isFluentCrmJsonSniff(sniffStr)) return { format: "fluentcrm-json", warnings };
    warnings.push(
      `JSON file "${filename}" lacks recognized WordPress or FluentCRM schema markers; classified as unknown`
    );
    return { format: "unknown", warnings };
  }

  // Auto detection
  if (ext === ".xml") {
    if (isWordPressWxrSniff(sniffStr)) {
      return { format: "wordpress-wxr", warnings };
    }
    warnings.push(`XML file "${filename}" is not a structurally recognized WordPress WXR export`);
    return { format: "unknown", warnings };
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
    if (isWordPressJsonSniff(sniffStr)) return { format: "wordpress-json", warnings };
    if (isFluentCrmJsonSniff(sniffStr)) return { format: "fluentcrm-json", warnings };
    warnings.push(
      `JSON file "${filename}" lacks recognized WordPress or FluentCRM schema markers; classified as unknown`
    );
    return { format: "unknown", warnings };
  }

  return { format: "unsupported", warnings };
}

function parseCsvHeaderCells(headerLine: string): string[] | null {
  const cells: string[] = [];
  let cell = "";
  let inQuote = false;
  for (let index = 0; index < headerLine.length; index += 1) {
    const character = headerLine[index];
    if (character === '"') {
      if (inQuote && headerLine[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuote = !inQuote;
      }
    } else if (character === "," && !inQuote) {
      cells.push(cell.trim().toLowerCase());
      cell = "";
    } else {
      cell += character;
    }
  }
  if (inQuote) return null;
  cells.push(cell.trim().replace(/^﻿/, "").toLowerCase());
  return cells;
}

function isFluentCrmCsvHeader(headerLine: string): boolean {
  const cells = parseCsvHeaderCells(headerLine);
  return cells !== null && cells.some((cell) =>
    cell === "contact_status" || cell === "subscriber_status"
  );
}

function hasWordPressCsvColumns(headerLine: string): boolean {
  const cells = parseCsvHeaderCells(headerLine);
  return cells !== null && WP_CSV_COLUMNS.some((column) => cells.includes(column));
}

function isWordPressWxrSniff(snippet: string): boolean {
  return WXR_RSS_MARKER.test(snippet) &&
    WXR_CHANNEL_MARKER.test(snippet) &&
    WXR_NAMESPACE_MARKER.test(snippet) &&
    WXR_VERSION_MARKER.test(snippet);
}

function isFluentCrmJsonSniff(snippet: string): boolean {
  return (/"contacts"\s*:/.test(snippet) || /"subscribers"\s*:/.test(snippet)) &&
    /"(?:email|contact_status|subscriber_status|status)"\s*:/.test(snippet);
}

function isWordPressJsonSniff(snippet: string): boolean {
  const hasRoot = /^\s*\[/.test(snippet) || /"(?:items|posts|lessons)"\s*:/.test(snippet);
  const hasType = /"(?:post_type|type)"\s*:/.test(snippet);
  const hasTitleOrContent = /"(?:post_title|title|post_content|content|body)"\s*:/.test(snippet);
  const hasIdentity = /"(?:post_id|id|post_name|slug)"\s*:/.test(snippet);
  return hasRoot && hasType && hasTitleOrContent && hasIdentity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isWordPressItem(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hasType = typeof value.post_type === "string" || typeof value.type === "string";
  const hasTitleOrContent =
    typeof value.post_title === "string" ||
    typeof value.title === "string" ||
    typeof value.post_content === "string" ||
    typeof value.content === "string" ||
    typeof value.body === "string";
  const hasIdentity =
    typeof value.post_id === "string" ||
    typeof value.post_id === "number" ||
    typeof value.id === "string" ||
    typeof value.id === "number" ||
    typeof value.post_name === "string" ||
    typeof value.slug === "string";
  return hasType && hasTitleOrContent && hasIdentity;
}

function extractWordPressItems(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value.length > 0 && value.every(isWordPressItem) ? value : null;
  if (!isRecord(value)) return null;
  for (const key of ["items", "posts", "lessons"] as const) {
    const candidate = value[key];
    if (Array.isArray(candidate) && candidate.length > 0 && candidate.every(isWordPressItem)) {
      return candidate;
    }
  }
  return null;
}

function extractFluentCrmContacts(value: unknown): unknown[] | null {
  if (!isRecord(value)) return null;
  const candidate = value.contacts ?? value.subscribers;
  if (!Array.isArray(candidate) || candidate.length === 0) return null;
  const structurallyValid = candidate.every((entry) => {
    if (!isRecord(entry)) return false;
    const hasIdentity = typeof entry.id === "string" || typeof entry.id === "number" || typeof entry.email === "string";
    const hasStatus =
      typeof entry.status === "string" ||
      typeof entry.contact_status === "string" ||
      typeof entry.subscriber_status === "string";
    return hasIdentity && hasStatus;
  });
  return structurallyValid ? candidate : null;
}

function detectBoundedJsonFormat(jsonSource: string): DetectResult {
  try {
    const parsed: unknown = JSON.parse(jsonSource);
    // WordPress wins when both reviewed structures are present. This prevents
    // contact-like words inside WordPress content from changing the source type.
    if (extractWordPressItems(parsed)) return { format: "wordpress-json", warnings: [] };
    if (extractFluentCrmContacts(parsed)) return { format: "fluentcrm-json", warnings: [] };
    return {
      format: "unknown",
      warnings: ["JSON content does not match a reviewed WordPress or FluentCRM export schema"],
    };
  } catch {
    return { format: "unknown", warnings: ["JSON parse error"] };
  }
}

async function countBoundedJsonRecords(
  jsonSource: string,
  bytes: number,
  format: "wordpress-json" | "fluentcrm-json"
): Promise<CountResult> {
  if (bytes > JSON_PARSE_LIMIT_BYTES) {
    return {
      recordCount: null,
      countConfidence: "unavailable",
      warnings: [`${format} exceeds the bounded JSON parse limit; exact count requires a streaming parser`],
    };
  }

  try {
    const parsed: unknown = JSON.parse(jsonSource);
    const records = format === "wordpress-json"
      ? extractWordPressItems(parsed)
      : extractFluentCrmContacts(parsed);
    if (!records) {
      return {
        recordCount: null,
        countConfidence: "unavailable",
        warnings: [`${format} does not match the reviewed export schema`],
      };
    }
    return { recordCount: records.length, countConfidence: "exact", warnings: [] };
  } catch {
    return { recordCount: null, countConfidence: "unavailable", warnings: ["JSON parse error"] };
  }
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
  filePath: string,
  fd: number,
  bytes: number,
  boundedJsonSource: string | null,
): Promise<CountResult> {
  switch (format) {
    case "wordpress-wxr": {
      const analysis = await analyzeWxr(filePath, fd);
      if (!analysis.structurallyValid) {
        return {
          recordCount: null,
          countConfidence: "unavailable",
          warnings: ["WordPress WXR structure is incomplete or invalid"],
        };
      }
      return { recordCount: analysis.itemCount, countConfidence: "exact", warnings: [] };
    }

    case "wordpress-csv":
    case "fluentcrm-csv": {
      const result = await countCsvRows(filePath, fd);
      if (result.malformed) {
        return {
          recordCount: null,
          countConfidence: "unavailable",
          warnings: ["Malformed CSV: unterminated quoted field at end of file"],
        };
      }
      return { recordCount: result.rows, countConfidence: "exact", warnings: [] };
    }

    case "wordpress-json":
      return countBoundedJsonRecords(boundedJsonSource ?? "", bytes, "wordpress-json");

    case "fluentcrm-json":
      return countBoundedJsonRecords(boundedJsonSource ?? "", bytes, "fluentcrm-json");

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

export interface AtomicWriteOperations {
  openSync: typeof fs.openSync;
  writeSync: typeof fs.writeSync;
  fsyncSync: typeof fs.fsyncSync;
  closeSync: typeof fs.closeSync;
  linkSync: typeof fs.linkSync;
  unlinkSync: typeof fs.unlinkSync;
}

const DEFAULT_ATOMIC_WRITE_OPERATIONS: AtomicWriteOperations = {
  openSync: fs.openSync,
  writeSync: fs.writeSync,
  fsyncSync: fs.fsyncSync,
  closeSync: fs.closeSync,
  linkSync: fs.linkSync,
  unlinkSync: fs.unlinkSync,
};

function syncOutputDirectory(dir: string, operations: AtomicWriteOperations): void {
  let directoryFd: number | null = null;
  try {
    directoryFd = operations.openSync(dir, fs.constants.O_RDONLY);
    operations.fsyncSync(directoryFd);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EINVAL" && code !== "ENOTSUP" && code !== "EPERM") {
      throw new Error("Inventory output directory synchronization failed");
    }
  } finally {
    if (directoryFd !== null) operations.closeSync(directoryFd);
  }
}

export function atomicWriteInventory(
  outPath: string,
  json: string,
  operations: AtomicWriteOperations = DEFAULT_ATOMIC_WRITE_OPERATIONS,
): void {
  const dir = path.dirname(path.resolve(outPath));
  const uniqueSuffix = crypto.randomBytes(16).toString("hex");
  const tmpPath = path.join(dir, `.inventory-${uniqueSuffix}.tmp`);
  let fd: number | null = null;
  let published = false;

  try {
    fd = operations.openSync(
      tmpPath,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
      0o600,
    );
    const reportBytes = Buffer.from(json, "utf8");
    let written = 0;
    while (written < reportBytes.length) {
      const bytesWritten = operations.writeSync(
        fd,
        reportBytes,
        written,
        reportBytes.length - written,
        written,
      );
      if (!Number.isInteger(bytesWritten) || bytesWritten <= 0) {
        throw new Error("Inventory output write did not make progress");
      }
      written += bytesWritten;
    }
    operations.fsyncSync(fd);
    operations.closeSync(fd);
    fd = null;

    operations.linkSync(tmpPath, outPath);
    published = true;
    operations.unlinkSync(tmpPath);
    syncOutputDirectory(dir, operations);
  } catch (error: unknown) {
    if (fd !== null) {
      try { operations.closeSync(fd); } catch { /* cleanup only */ }
    }
    try { operations.unlinkSync(tmpPath); } catch { /* cleanup only */ }
    if (published) {
      try { operations.unlinkSync(outPath); } catch { /* cleanup only */ }
    }

    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Output file "${path.basename(outPath)}" already exists; refusing to overwrite`);
    }
    if (error instanceof Error && error.message.startsWith("Inventory output directory")) {
      throw error;
    }
    throw new Error(published
      ? "Inventory output finalization failed"
      : "Inventory output write failed");
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
  let inputFd: number | null = null;
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
    const noFollow = "O_NOFOLLOW" in fs.constants ? fs.constants.O_NOFOLLOW : 0;
    inputFd = fs.openSync(filePath, fs.constants.O_RDONLY | noFollow);
    const openedStat = fs.fstatSync(inputFd);
    if (!openedStat.isFile() || openedStat.dev !== lstat.dev || openedStat.ino !== lstat.ino) {
      fs.closeSync(inputFd);
      inputFd = null;
      return {
        path: filename,
        bytes: 0,
        sha256: "",
        detectedFormat: "unknown" as SupportedFormat,
        recordCount: null,
        countConfidence: "unavailable",
        warnings: ["Input identity changed before it could be opened safely"],
        status: "rejected",
      };
    }
    bytes = openedStat.size;
  } catch (err: unknown) {
    if (inputFd !== null) {
      try { fs.closeSync(inputFd); } catch { /* cleanup only */ }
      inputFd = null;
    }
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

  try {
  if (bytes === 0) {
    warnings.push("File is empty");
  }

  // Streaming SHA-256
  let checksum = "";
  try {
    checksum = await sha256Stream(filePath, inputFd);
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
    sniff = bytes > 0 ? readSniffBuffer(inputFd) : Buffer.alloc(0);
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

  let { format: detectedFormat, warnings: detectWarnings } = detectFormat(hint, filename, sniff);
  const isJsonCandidate = hint === "json" || (hint === "auto" && path.extname(filename).toLowerCase() === ".json");
  const boundedJsonSource = isJsonCandidate && bytes <= JSON_PARSE_LIMIT_BYTES
    ? readBoundedUtf8(inputFd, bytes)
    : null;
  if (detectedFormat !== "unsupported" && isJsonCandidate && bytes <= JSON_PARSE_LIMIT_BYTES) {
    ({ format: detectedFormat, warnings: detectWarnings } = detectBoundedJsonFormat(boundedJsonSource ?? ""));
  }
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
    filePath,
    inputFd,
    bytes,
    boundedJsonSource,
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
  } finally {
    fs.closeSync(inputFd);
  }
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
    atomicWriteInventory(config.outPath, json);
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
