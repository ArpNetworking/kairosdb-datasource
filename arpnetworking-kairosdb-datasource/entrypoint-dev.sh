#!/bin/sh

echo "🚀 Starting KairosDB Plugin Development Environment"
echo "DEV mode: ${DEV}"
echo "Node environment: ${NODE_ENV}"
echo "Plugin logging: ${GF_LOG_FILTERS}"

if [ "${DEV}" = "false" ]; then
    echo "Starting production mode"
    exec /run.sh
fi

echo "🔧 Starting development mode with enhanced debugging"
echo "📊 Plugin location: /var/lib/grafana/plugins/arpnetworking-kairosdb-datasource"

# Check if plugin directory exists and list contents
if [ -d "/var/lib/grafana/plugins/arpnetworking-kairosdb-datasource" ]; then
    echo "✅ Plugin directory exists, contents:"
    ls -la /var/lib/grafana/plugins/arpnetworking-kairosdb-datasource/
else
    echo "❌ Plugin directory not found!"
    mkdir -p /var/lib/grafana/plugins/arpnetworking-kairosdb-datasource
fi

# Start Grafana in development mode with enhanced logging
echo "🚀 Starting Grafana in development mode..."
exec /run.sh