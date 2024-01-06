FROM ubuntu as build
RUN apt update && \
	DEBIAN_FRONTEND=noninteractive apt install -y curl && \
	rm -rf /var/lib/apt/lists/*
ENV NVM_DIR=/usr/local/nvm
ENV NODE_VERSION=v20.8.0
RUN touch /root/.bashrc && \
    mkdir $NVM_DIR && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash && \
    . $NVM_DIR/nvm.sh && \
    nvm install $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    nvm use default && \
	npm install -g grunt-cli && \
	npm install -g yarn && \
    chown -R 1000:1000 /root/.npm

ENV PATH=$NVM_DIR/versions/node/$NODE_VERSION/bin:$PATH
WORKDIR /root/
COPY package.json /root/
COPY package-lock.json /root/
RUN npm install
COPY . /root/
RUN npm install
RUN grunt --force

FROM grafana/grafana:7.3.10 as prod
COPY --from=build /root/dist /var/lib/grafana/plugins/kairosdb
COPY docker/provisioning /etc/grafana/provisioning
