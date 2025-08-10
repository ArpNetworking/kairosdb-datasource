#!/bin/bash

# Development entrypoint for KairosDB Grafana plugin

set -e

echo "🚀 KairosDB Grafana Plugin Development Container"
echo "📊 Plugin location: /var/lib/grafana/plugins/kairosdb-datasource"
echo "🔧 Development mode: $DEV"
echo "👤 Anonymous auth: $GF_AUTH_ANONYMOUS_ENABLED"
echo ""

# List plugin files for debugging
echo "📦 Plugin files:"
ls -la /var/lib/grafana/plugins/kairosdb-datasource/ || echo "No plugin files found"
echo ""

# Check if plugin.json exists
if [ -f "/var/lib/grafana/plugins/kairosdb-datasource/plugin.json" ]; then
    echo "✅ plugin.json found"
    echo "📋 Plugin info:"
    cat /var/lib/grafana/plugins/kairosdb-datasource/plugin.json | head -10
else
    echo "❌ plugin.json not found - plugin may not be built"
fi
echo ""

# Start Grafana in the foreground
echo "🌟 Starting Grafana server..."
exec /run.sh "$@"