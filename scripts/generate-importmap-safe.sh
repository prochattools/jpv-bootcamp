#!/bin/bash
set -e

# Try to generate importmap
if pnpm generate:importmap 2>/dev/null; then
  exit 0
fi

# If it fails, create a placeholder - Payload will regenerate at runtime
cat > .payload.importmap.js <<'IMPORTMAP_EOF'
module.exports = {}
IMPORTMAP_EOF

exit 0
