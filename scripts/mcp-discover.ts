import { loadEnvFiles } from "./mcp-load-env";

loadEnvFiles();

const MCP_API_URL = process.env.MCP_API_URL;
const MCP_SECRET = process.env.MCP_SECRET;

if (!MCP_API_URL || !MCP_SECRET) {
  console.error("Missing MCP_API_URL or MCP_SECRET in env.");
  process.exit(1);
}

const baseUrl = MCP_API_URL.replace(/\/+$/, "");
let origin = baseUrl;
try {
  origin = new URL(baseUrl).origin;
} catch (error) {
  console.error("Invalid MCP_API_URL:", error);
  process.exit(1);
}

const endpoints = [
  `${baseUrl}/health`,
  `${baseUrl}/status`,
  `${origin}/health`,
  `${origin}/status`,
  `${origin}/openapi.json`,
  `${origin}/swagger.json`,
  `${origin}/docs`,
  `${origin}/tools`,
  `${origin}/schema`,
];

const headerVariants: Array<{ name: string; value: string }> = [
  { name: "Authorization", value: `Bearer ${MCP_SECRET}` },
  { name: "X-API-Key", value: MCP_SECRET },
  { name: "X-MCP-Secret", value: MCP_SECRET },
];

const redact = (input: string): string => {
  if (!input) return input;
  return input.replaceAll(MCP_SECRET, "***");
};

const tryRequest = async (
  url: string,
  method: "GET" | "POST",
  headerName: string,
  headerValue: string,
): Promise<{ status: number; body: string }> => {
  const headers = new Headers();
  headers.set(headerName, headerValue);
  if (method === "POST") {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? "{}" : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text };
};

const run = async (): Promise<void> => {
  for (const endpoint of endpoints) {
    for (const { name, value } of headerVariants) {
      for (const method of ["GET", "POST"] as const) {
        try {
          const { status, body } = await tryRequest(endpoint, method, name, value);
          const preview = redact(body).slice(0, 500);
          console.log(`${method} ${endpoint} via ${name}: ${status}`);
          console.log(preview);
          if (status === 200) {
            console.log(
              `FOUND: ${method} ${endpoint} with header ${name} returned 200.`,
            );
            return;
          }
        } catch (error) {
          console.log(
            `${method} ${endpoint} via ${name}: error ${String(error)}`,
          );
        }
      }
    }
  }

  console.error("No 200 response found for any endpoint/header combination.");
  process.exit(1);
};

run().catch((error) => {
  console.error("Discovery failed:", error);
  process.exit(1);
});
