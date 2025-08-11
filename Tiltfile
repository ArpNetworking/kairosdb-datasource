# Tiltfile for KairosDB Grafana Datasource Plugin Development

# Build the React-based KairosDB datasource plugin
docker_build(
    'kairosdb-plugin',
    '.',
    dockerfile='./Dockerfile',
    build_args={
        'grafana_version': 'latest',
        'grafana_image': 'grafana/grafana',
        'development': 'true',
        'anonymous_auth_enabled': 'true'
    },
    # Live update for fast development iteration
    live_update=[
        # Sync built plugin files to Grafana plugins directory
        sync('./dist', '/var/lib/grafana/plugins/arpnetworking-kairosdb-datasource'),
        # Sync provisioning config
        sync('./docker/provisioning', '/etc/grafana/provisioning')
    ]
)

# Build plugin in development mode when source changes
# This rebuilds dist/ which triggers the live_update above
local_resource(
  'build-plugin',
  cmd='npm run build',
  deps=['./src'],
  labels=['build']
)

# Deploy Kubernetes manifests
k8s_yaml('k8s/deployment.yaml')

# Create ConfigMaps from provisioning files (excluding large dashboard files)
local_resource(
  'create-configmaps',
  cmd='''
kubectl create configmap grafana-dashboards-config \
  --from-file=dashboards.yaml=docker/provisioning/dashboards/dashboards.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-datasources-config \
  --from-file=kairosdb.yaml=docker/provisioning/datasources/kairosdb.yaml \
  --dry-run=client -o yaml | kubectl apply -f -
  ''',
  deps=['docker/provisioning'],
  labels=['setup']
)

# Port forward for Grafana
k8s_resource('grafana-kairosdb', port_forwards='3000:3000')

# Watch for changes in configuration files
watch_file('./docker/provisioning')
watch_file('./docker/dashboards')

print("🚀 KairosDB Plugin Development Environment")
print("📊 Grafana: http://localhost:3000 (admin/admin)")
print("🔄 Plugin changes will trigger automatic rebuilds")