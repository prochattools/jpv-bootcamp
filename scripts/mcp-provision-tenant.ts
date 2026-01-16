import { loadEnvFiles } from "./mcp-load-env";

loadEnvFiles();

const MCP_API_URL = process.env.MCP_API_URL;
const MCP_SECRET = process.env.MCP_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

const readArg = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

const slug = readArg("--slug");

if (!MCP_API_URL || !MCP_SECRET) {
  console.error("Missing MCP_API_URL or MCP_SECRET in env.");
  process.exit(1);
}

if (!slug) {
  console.error("Missing required --slug argument.");
  process.exit(1);
}

const authHeader = { name: "Authorization", value: `Bearer ${MCP_SECRET}` };

const redact = (input: string): string => {
  if (!input) return input;
  let output = input.replaceAll(MCP_SECRET, "***");
  if (DATABASE_URL) {
    output = output.replaceAll(DATABASE_URL, "<redacted:database_url>");
  }
  return output;
};

const buildBodies = (): Array<{ label: string; body: Record<string, unknown> }> => {
  const bodies: Array<{ label: string; body: Record<string, unknown> }> = [
    {
      label: "tool-envelope (slug)",
      body: { tool: "provisionTenant", args: { slug } },
    },
  ];

  if (DATABASE_URL) {
    bodies.push({
      label: "tool-envelope (slug + databaseUrl)",
      body: { tool: "provisionTenant", args: { slug, databaseUrl: DATABASE_URL } },
    });
  }

  bodies.push({
    label: "json-rpc",
    body: { jsonrpc: "2.0", id: "1", method: "provisionTenant", params: { slug } },
  });

  return bodies;
};

const tryProvision = async (
  body: Record<string, unknown>,
): Promise<{ status: number; bodyText: string }> => {
  const headers = new Headers();
  headers.set(authHeader.name, authHeader.value);
  headers.set("Content-Type", "application/json");

  const response = await fetch(MCP_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return { status: response.status, bodyText: await response.text() };
};

const isMissingSql = (bodyText: string): boolean => {
  return bodyText.toLowerCase().includes("missing sql");
};

const run = async (): Promise<void> => {
  const bodies = buildBodies();
  let lastStatus = 0;
  let lastBody = "";

  for (const { label, body } of bodies) {
    console.log(`POST ${MCP_API_URL} with ${label} via Authorization`);
    try {
      const { status, bodyText } = await tryProvision(body);
      lastStatus = status;
      lastBody = bodyText;

      if (isMissingSql(bodyText)) {
        console.error(
          "Endpoint appears to be a SQL gateway (/query). Raw SQL provisioning is disallowed by ProKit rules. Provide an MCP tool endpoint that triggers db:init or run the scripts inside the VNet.",
        );
        process.exit(1);
      }

      if (status === 200 || status === 201) {
        try {
          const json = JSON.parse(bodyText);
          console.log(JSON.stringify(json, null, 2));
        } catch {
          console.log(redact(bodyText));
        }
        return;
      }

      console.log(`Status: ${status}`);
      console.log(redact(bodyText).slice(0, 2000));
    } catch (error) {
      console.log(`Error: ${String(error)}`);
    }
  }

  console.error(`Provisioning failed. Last status: ${lastStatus}`);
  console.error(redact(lastBody).slice(0, 2000));
  process.exit(1);
};

run().catch((error) => {
  console.error("Provisioning failed:", error);
  process.exit(1);
});
