# Staging Traefik File Provider Setup

## One-time operator setup required

The staging preview URL (`preview.jpvbootcamp.com`) is routed via Traefik's file
provider, not via Docker Swarm service labels. This is because Dokploy writes
`labelsSwarm` to `TaskTemplate.ContainerSpec.Labels`, but Traefik's swarm
provider reads service-level labels (`Spec.Labels`). These are different fields.

The file provider config is written to the **HOST filesystem** at:
```
/etc/dokploy/traefik/dynamic/preview-jpvbootcamp.yml
```

Traefik watches this directory with `file.watch: true` and hot-reloads it. The
file survives all Docker service deploys since deploys only modify the service
container, not the host filesystem.

## Config template

Write this file to the Dokploy host server:

```yaml
# /etc/dokploy/traefik/dynamic/preview-jpvbootcamp.yml
http:
  routers:
    preview-jpvbootcamp-web:
      rule: 'Host(`preview.jpvbootcamp.com`)'
      service: preview-jpvbootcamp-service
      entryPoints:
        - web
        - websecure
  services:
    preview-jpvbootcamp-service:
      loadBalancer:
        servers:
          - url: http://clients-jpv-bootcamp-app-tp9xrk:3000
        passHostHeader: true
```

Note: no `tls` block in the router — TLS is handled globally by the `websecure`
entrypoint in `traefik.yml` which applies `certResolver: letsencrypt` to all
websecure routes.

## How to write the file

SSH to the Dokploy host and run:

```bash
sudo tee /etc/dokploy/traefik/dynamic/preview-jpvbootcamp.yml > /dev/null << 'EOF'
http:
  routers:
    preview-jpvbootcamp-web:
      rule: 'Host(`preview.jpvbootcamp.com`)'
      service: preview-jpvbootcamp-service
      entryPoints:
        - web
        - websecure
  services:
    preview-jpvbootcamp-service:
      loadBalancer:
        servers:
          - url: http://clients-jpv-bootcamp-app-tp9xrk:3000
        passHostHeader: true
EOF
```

Traefik will hot-reload within 2-3 seconds. Verify via:

```bash
# Check router is registered
curl -s http://localhost:8080/api/http/routers | python3 -c \
  "import json,sys; [print(r['name']) for r in json.load(sys.stdin) if 'preview' in r['name'].lower()]"

# Verify HTTP 200
curl -s -o /dev/null -w "%{http_code}" -H "Host: preview.jpvbootcamp.com" http://localhost:80/
```

## Why `ensurePreviewRouting.mts` verifies this

The deploy workflow calls `ensurePreviewRouting.mts` before triggering
`application.deploy`. This script:
1. Sets `labelsSwarm` in Dokploy's DB via `application.update` (belt-and-suspenders)
2. Verifies `https://preview.jpvbootcamp.com` returns a non-404 status

If the file is missing or Traefik hasn't loaded it, step 2 fails with
`ROUTING-FAILED` and the deploy is blocked. This ensures every deploy only
proceeds when routing is confirmed working.
