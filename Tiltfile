# Tiltfile for KairosDB Grafana Datasource Plugin Development

# Build the plugin using a multi-stage Docker build
docker_build(
    'kairosdb-plugin-dev',
    '.',
    dockerfile='Dockerfile',
    # Watch for changes in source files and configuration
    live_update=[
        # Sync source code changes
        sync('./src', '/root/src'),
        sync('./specs', '/root/specs'),
        sync('./package.json', '/root/package.json'),
        sync('./package-lock.json', '/root/package-lock.json'),
        sync('./Gruntfile.js', '/root/Gruntfile.js'),
        sync('./tsconfig.json', '/root/tsconfig.json'),
        sync('./tslint.json', '/root/tslint.json'),
        sync('./plugin.json', '/root/plugin.json'),
        
        # Rebuild the plugin when source changes
        run('cd /root && grunt', trigger=['./src', './specs', './Gruntfile.js', './tsconfig.json', './plugin.json'])
    ]
)

# Deploy the Kubernetes manifests  
k8s_yaml('k8s/deployment.yaml')

# Create ConfigMaps directly from original docker files
local_resource(
  'create-configmaps',
  cmd='''
kubectl create configmap grafana-dashboards-config \
  --from-file=dashboards.yaml=docker/provisioning/dashboards/dashboards.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-datasources-config \
  --from-file=kairosdb.yaml=docker/provisioning/datasources/kairosdb.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-dashboards \
  --from-file=docker/dashboards/ \
  --dry-run=client -o yaml | kubectl apply -f -
  ''',
  deps=['docker/provisioning', 'docker/dashboards'],
  labels=['setup']
)

# Port forward to access Grafana locally
k8s_resource('grafana-kairosdb', port_forwards='3000:3000')

# Watch for changes in docker configuration
watch_file('./docker/provisioning')
watch_file('./docker/dashboards')

# Display helpful information
local_resource(
  'dev-info',
  cmd='echo "Grafana KairosDB Plugin Development Environment"',
  deps=['./README.md'],
  labels=['info']
)

print("🚀 Grafana with KairosDB plugin will be available at http://localhost:3000")
print("📊 Anonymous access is enabled with Admin role")
print("🔧 Plugin changes will trigger automatic rebuilds")