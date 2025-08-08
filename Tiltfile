# Tiltfile for KairosDB Grafana Datasource Plugin Development - Old vs New

# Build the OLD Angular-based plugin 
docker_build(
    'kairosdb-plugin-old',
    './kairosdb-datasource-old',
    dockerfile='./kairosdb-datasource-old/Dockerfile.old',
    # Watch for changes in old plugin files
    live_update=[
        # Sync source code changes for old plugin
        sync('./kairosdb-datasource-old/src', '/root/src'),
        sync('./kairosdb-datasource-old/specs', '/root/specs'),
        sync('./kairosdb-datasource-old/package.json', '/root/package.json'),
        sync('./kairosdb-datasource-old/Gruntfile.js', '/root/Gruntfile.js'),
        sync('./kairosdb-datasource-old/tsconfig.json', '/root/tsconfig.json'),
        sync('./kairosdb-datasource-old/tslint.json', '/root/tslint.json'),
        sync('./kairosdb-datasource-old/plugin.json', '/root/plugin.json'),
        
        # Rebuild the old plugin when source changes
        run('cd /root && grunt', trigger=['./kairosdb-datasource-old/src', './kairosdb-datasource-old/specs'])
    ]
)

# Build the NEW React-based plugin
docker_build(
    'kairosdb-plugin-new',
    './arpnetworking-kairosdb-datasource',
    dockerfile='./arpnetworking-kairosdb-datasource/Dockerfile.new',
    # Watch for changes in new plugin files
    live_update=[
        # Sync source code changes for new plugin
        sync('./arpnetworking-kairosdb-datasource/src', '/root/src'),
        sync('./arpnetworking-kairosdb-datasource/package.json', '/root/package.json'),
        sync('./arpnetworking-kairosdb-datasource/tsconfig.json', '/root/tsconfig.json'),
        
        # Rebuild the new plugin when source changes
        run('cd /root && npm run build', trigger=['./arpnetworking-kairosdb-datasource/src'])
    ]
)

# Deploy separate Kubernetes manifests for old and new plugins
k8s_yaml('k8s/deployment-old.yaml')
k8s_yaml('k8s/deployment-new.yaml')

# Create ConfigMaps directly from original docker files
local_resource(
  'create-configmaps',
  cmd='''
kubectl create configmap grafana-dashboards-config \
  --from-file=dashboards.yaml=docker/provisioning/dashboards/dashboards.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-datasources-config-old \
  --from-file=kairosdb.yaml=docker/provisioning/datasources/kairosdb-old.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-datasources-config-new \
  --from-file=kairosdb.yaml=docker/provisioning/datasources/kairosdb.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-dashboards \
  --from-file=docker/dashboards/ \
  --dry-run=client -o yaml | kubectl apply -f -
  ''',
  deps=['docker/provisioning', 'docker/dashboards'],
  labels=['setup']
)

# Port forwards for both old and new plugins
k8s_resource('grafana-kairosdb-old', port_forwards='3000:3000')
k8s_resource('grafana-kairosdb-new', port_forwards='3001:3000')

# Watch for changes in docker configuration
watch_file('./docker/provisioning')
watch_file('./docker/dashboards')

# Display helpful information
local_resource(
  'dev-info',
  cmd='''
echo "🚀 KairosDB Plugin Development Environment - Side by Side Comparison"
echo "📊 OLD Plugin (Angular): http://localhost:3000 - Anonymous admin access"
echo "⚛️  NEW Plugin (React):   http://localhost:3001 - Anonymous admin access"
echo "🔧 Changes trigger automatic rebuilds for both versions"
  ''',
  deps=['./README.md'],
  labels=['info']
)

print("🚀 KairosDB Plugin Development Environment - Side by Side!")
print("📊 OLD Plugin (Angular): http://localhost:3000")
print("⚛️  NEW Plugin (React):   http://localhost:3001")
print("🔧 Plugin changes will trigger automatic rebuilds")