from grafana/grafana:7.3.10
copy dist /var/lib/grafana/plugins/kairosdb
copy docker/provisioning /etc/grafana/provisioning
