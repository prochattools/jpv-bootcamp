<!-- Summary: Added MCP discovery/provision scripts with env auto-load and SQL-gateway detection; updated npm scripts and MCP docs. -->
# MCP Bridge Usage

This repo includes helper scripts to discover the MCP endpoint and invoke
tenant provisioning without guessing request shape or auth header.

## Environment

Set these env vars before running the scripts:

- `MCP_API_URL` (example: `https://mcp.prochat.tools/query`)
- `MCP_SECRET` (server-only secret)
- `DATABASE_URL` (optional, passed to MCP when supported)

## Discovery

Find a working endpoint and auth header:

```bash
npm run mcp:discover
```

The script tests a shortlist of endpoints with multiple auth headers and
prints the first `200` response it finds, along with a body preview.

## SQL Gateway Note

`https://mcp.prochat.tools/query` responds with `{"error":"Missing SQL"}` when
authorized. That endpoint is a SQL gateway, not the MCP tool RPC.

ProKit rules prohibit running raw SQL against production. Use the MCP tool
endpoint that triggers `npm run db:init`/`db:migrate:prod`, or run those scripts
inside the VNet/Dokploy.

Example SQL gateway request (diagnostic only):

```bash
curl -sS https://mcp.prochat.tools/query \
  -H "Authorization: Bearer <MCP_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"sql":"select 1 as ok;"}'
```

## Provision a Tenant

Run tenant provisioning for a slug:

```bash
npm run mcp:provision -- --slug jpvbootcamp
```

The script tries:
- Tool envelope body: `{ "tool": "provisionTenant", "args": { "slug": "..." } }`
- Tool envelope + `databaseUrl` (if `DATABASE_URL` is set)
- JSON-RPC body: `{ "jsonrpc": "2.0", "id": "1", "method": "provisionTenant", "params": { "slug": "..." } }`

## Working MCP Details (fill after discovery)

- Endpoint: `<fill after running mcp:discover>`
- Auth header: `<Authorization|X-API-Key|X-MCP-Secret>`
- Body shape: `<tool-envelope|json-rpc>`

## Production Migrations

After provisioning succeeds, run migrations against production:

```bash
npm run db:migrate:prod
```

Make sure `DATABASE_URL` points at the production tenant database.
