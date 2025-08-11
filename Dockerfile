ARG grafana_version=latest
ARG grafana_image=grafana/grafana

FROM ${grafana_image}:${grafana_version}

ARG anonymous_auth_enabled=true
ARG development=true
ARG TARGETARCH

ENV DEV "${development}"

# Make it as simple as possible to access the grafana instance for development purposes
# Do NOT enable these settings in a public facing / production grafana instance
ENV GF_AUTH_ANONYMOUS_ORG_ROLE "Admin"
ENV GF_AUTH_ANONYMOUS_ENABLED "${anonymous_auth_enabled}"
ENV GF_AUTH_BASIC_ENABLED "false"
# Set development mode so plugins can be loaded without the need to sign
ENV GF_DEFAULT_APP_MODE "development"
# Allow loading unsigned plugins (for development)
ENV GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS "arpnetworking-kairosdb-datasource"

LABEL maintainer="Arp Networking <support@arpnetworking.com>"

ENV GF_PATHS_HOME="/usr/share/grafana"
WORKDIR $GF_PATHS_HOME

USER root

# Installing supervisor and inotify-tools for development
RUN if [ "${development}" = "true" ]; then \
    if grep -i -q alpine /etc/issue; then \
        apk add --no-cache supervisor inotify-tools git nodejs npm; \
    elif grep -i -q ubuntu /etc/issue; then \
        DEBIAN_FRONTEND=noninteractive && \
        apt-get update && \
        apt-get install -y supervisor inotify-tools git nodejs npm && \
        rm -rf /var/lib/apt/lists/*; \
    else \
        echo 'ERROR: Unsupported base image' && /bin/false; \
    fi \
fi

# Copy plugin files to Grafana plugins directory
COPY dist /var/lib/grafana/plugins/arpnetworking-kairosdb-datasource

# Copy provisioning configuration (will be overridden by live_update)
COPY docker/provisioning /etc/grafana/provisioning

# Copy dashboard files directly into the image
COPY docker/dashboards /var/lib/grafana/dashboards

# Copy entrypoint script
COPY entrypoint-dev.sh /entrypoint-dev.sh
RUN chmod +x /entrypoint-dev.sh

# Inject livereload script for development
RUN if [ "${development}" = "true" ]; then \
    sed -i 's|</body>|<script src="http://localhost:35729/livereload.js"></script></body>|g' /usr/share/grafana/public/views/index.html; \
fi

# Switch back to grafana user
USER grafana

EXPOSE 3000

ENTRYPOINT ["/entrypoint-dev.sh"]