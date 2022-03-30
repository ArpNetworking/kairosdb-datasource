from node:13 as build

workdir /root
run npm install -g grunt
run apt update && apt install zip
add package.json yarn.lock /root
run npm install
add . /root
run yarn build
run cp -R dist kairosdb-datasource

from grafana/grafana as main
copy --from=build /root/dist /var/lib/grafana/plugins/kairosdb-datasource
ENV GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=grafana-kairosdb-datasource

