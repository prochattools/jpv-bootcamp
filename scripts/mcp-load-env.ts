import fs from "node:fs";
import path from "node:path";

const parseEnvLine = (
  line: string,
): { key: string; value: string } | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const equalsIndex = trimmed.indexOf("=");
  if (equalsIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
};

const loadEnvFile = (
  filePath: string,
  alreadyDefined: Set<string>,
  allowOverride: boolean,
  loadedKeys: Set<string>,
): void => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;

    const { key, value } = parsed;
    if (alreadyDefined.has(key)) continue;
    if (!allowOverride && loadedKeys.has(key)) continue;

    process.env[key] = value;
    loadedKeys.add(key);
  }
};

export const loadEnvFiles = (): void => {
  const cwd = process.cwd();
  const alreadyDefined = new Set(Object.keys(process.env));
  const loadedKeys = new Set<string>();

  loadEnvFile(path.join(cwd, ".env"), alreadyDefined, false, loadedKeys);
  loadEnvFile(path.join(cwd, ".env.local"), alreadyDefined, true, loadedKeys);
};
