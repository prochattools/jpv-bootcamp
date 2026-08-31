# Infrastructure & Networking Reference

**Last verified:** 2026-07-29  
**Verified by:** Live SSH inspection, Azure CLI, Tailscale API, Docker Swarm inspection

This document is the canonical reference for how the staging/preview deployment connects
to its database. Read this before touching `DATABASE_URL`, firewall rules, or Tailscale.

---

## Server Inventory

| Server | Role | Cloud | Public IP | Tailscale IP | Private NIC | SSH |
|--------|------|-------|-----------|--------------|-------------|-----|
| `dokploy` | App host — Docker Swarm, Dokploy | Azure `PROCHAT-APPS` / Spain Central | `68.221.139.108` | `100.83.38.48` | `172.16.0.4/24` | `ssh master@68.221.139.108` |
| `supabase` | Database host — Supabase self-hosted | Azure `supabase-azure` / Spain Central | `68.221.194.245` | `100.71.31.88` | `10.0.2.4/24` | `ssh master@100.71.31.88` |

> **Important:** The two servers are in different Azure VNets and different private subnets.
> The Dokploy server's private NIC is `172.16.0.x`. The Supabase server's private NIC is `10.0.2.x`.
> They are **not** on the same Layer-2 network and cannot reach each other's private IPs directly.

---

## How the App Container Reaches the Database

The `DATABASE_URL` in both `.env.production` and Dokploy's environment uses:

```
10.0.2.4:5433
```

This is the Supabase server's **private NIC IP**. It is reachable from the Dokploy server
**exclusively via Tailscale subnet routing**:

1. The Supabase server's Tailscale node (`100.71.31.88`) advertises `10.0.2.0/24` as a
   subnet route to the entire Tailscale mesh.
2. The Dokploy server's Tailscale node (`100.83.38.48`) accepts that route via
   `--accept-routes`.
3. When both Tailscale nodes are online, traffic to `10.0.2.4` from the Dokploy server
   (and from its Docker Swarm containers) is transparently routed through the Tailscale
   tunnel to the Supabase server.

**Do NOT change `10.0.2.4` to any other address.** It is the correct and intended path.
Using the Tailscale IP (`100.71.31.88`) or the public IP (`68.221.194.245`) would bypass
the intended security boundary and expose the database port differently.

### Local development

From your local machine (`office`, Tailscale `100.86.124.66`), connect using the
Tailscale IP directly (since there is no `10.0.2.x` route on your Mac):

```
postgresql://...@100.71.31.88:5433/jpvbootcamp
```

---

## Database Port Firewall Rules

Port `5433` on the Supabase server is protected at two layers:

### Layer 1 — Azure NSG (`nsg-db`, resource group `rg-saas-infra`)

| Rule name | Priority | Source | Port | Action |
|-----------|----------|--------|------|--------|
| `Allow-Postgres-From-Dokploy` | 120 | `10.0.1.0/24` | 5433 | Allow |

`10.0.1.0/24` is the Dokploy server's Azure VNet subnet — this allows the Swarm host's
private Azure NIC to reach Supabase IF they were on the same VNet (they are not currently
peered, so this rule is in effect dormant; actual traffic flows via Tailscale).

### Layer 2 — UFW on Supabase host

```
5433/tcp on tailscale0     ALLOW IN    100.83.38.48        ← Dokploy Tailscale IP
5433/tcp on eth0           DENY IN     Anywhere            ← Public internet blocked
```

Only the Dokploy server's Tailscale IP is allowed to reach port 5433. All public internet
traffic to port 5433 is denied, even if the NSG were to allow it.

### Layer 3 — PostgreSQL `pg_hba.conf`

Accepts connections from `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, and `0.0.0.0/0`
with `scram-sha-256` authentication. Authentication credentials are required regardless of
network path.

---

## Tailscale Configuration

### Supabase server

- Advertises subnet route: `10.0.2.0/24`
- This makes `10.0.2.4` (its own `eth0`) reachable by all other Tailscale nodes
- Check with: `ssh master@100.71.31.88 'tailscale status --json | python3 -c "import sys,json; s=json.load(sys.stdin); print(s[\"Self\"][\"AllowedIPs\"])"'`

### Dokploy server

- Accepts routes: `--accept-routes` must be set
- Auto-update: **must be disabled** (see incident below)
- Operator: `master` user should have operator rights to manage Tailscale without sudo

To verify Dokploy Tailscale is up and routing correctly:

```bash
ssh master@68.221.139.108 'tailscale status && nc -zv 10.0.2.4 5433 -w 5'
```

Expected output: Tailscale shows `supabase` as active, then `Connection to 10.0.2.4 5433 port [tcp/*] succeeded!`

---

## Incident: 2026-07-29 — Tailscale Auto-Update Breaks DB Connectivity

**What happened:**  
Tailscale on the Dokploy server auto-updated at ~16:43 WEST. The daemon restarted
(`PID 958866 → 3229729`) and the post-update restart lost its auth token, logging the
node out of the Tailscale mesh. With Tailscale offline, the `10.0.2.0/24` subnet route
disappeared, making `10.0.2.4:5433` unreachable from the app container.

**Symptom:** Both Payload (`pg-pool`) and Prisma timed out connecting to the database
at every page load, returning 500 after exactly 10 seconds (`connectionTimeoutMillis`).

**Resolution:**  
1. Re-authenticated the Dokploy Tailscale node at `https://login.tailscale.com/a/...`
2. Disabled Tailscale auto-update on the Dokploy server:
   ```bash
   sudo tailscale set --operator=master   # grant master operator rights (once)
   tailscale set --auto-update=false       # disable auto-update permanently
   ```

**Prevention:**  
- Auto-update is disabled on Dokploy.
- If this recurs: SSH to `68.221.139.108` as `master`, run `tailscale up`, and approve
  the device in the Tailscale admin console.
- Monitor: `tailscale status` should show `supabase` as active and `nc -zv 10.0.2.4 5433`
  should succeed from the Dokploy host.

---

## Dokploy Deployment

- **App:** `clients-jpv-bootcamp-app-tp9xrk` (applicationId: `I_2Vukga3cc3ZhaG-mUzU`)
- **Staging URL:** `https://preview.jpvbootcamp.com`
- **Dokploy API:** `https://dokploy.prochat.tools/api` (Cloudflare-proxied)
- **Credentials:** `/Users/Office/.config/dokploy/.env`
- **Image registry:** `ghcr.io/prochattools/jpv-bootcamp`

Deployments are done via `docker service update` over SSH to `master@68.221.139.108`.
The Dokploy REST API alone does not force a re-pull — SSH + service update is required
to pick up a new image or updated environment variables.

See `docs/DOKPLOY_DEPLOYMENT_GUIDE.md` for the full deployment procedure.

---

## Quick Diagnostics Checklist

If the app cannot connect to the database:

```bash
# 1. Is Tailscale up on Dokploy?
ssh master@68.221.139.108 'tailscale status | grep supabase'
# Expected: supabase ... active

# 2. Is 10.0.2.4:5433 reachable from Dokploy host?
ssh master@68.221.139.108 'nc -zv 10.0.2.4 5433 -w 5'
# Expected: Connection ... succeeded

# 3. Is the container using 10.0.2.4?
ssh master@68.221.139.108 'docker service inspect clients-jpv-bootcamp-app-tp9xrk' \
  | python3 -c "import sys,json,re; d=json.load(sys.stdin); [print(e) for e in d[0]['Spec']['TaskTemplate']['ContainerSpec'].get('Env',[]) if 'DATABASE' in e and print(re.search(r'@([^/]+)/', e).group(1))]"
# Expected: 10.0.2.4:5433

# 4. Is Supabase DB healthy?
ssh master@100.71.31.88 'docker ps --filter name=supabase-db --format "{{.Status}}"'
# Expected: Up ... (healthy)

# 5. Check app health endpoint
curl -s https://preview.jpvbootcamp.com/api/health
```
