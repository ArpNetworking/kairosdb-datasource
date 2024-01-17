FROM ubuntu as build
RUN apt update && \
	DEBIAN_FRONTEND=noninteractive apt install -y curl gnupg-agent zip && \
	rm -rf /var/lib/apt/lists/*
RUN curl -q -o- https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list && \
    DEBIAN_FRONTEND=noninteractive apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y google-chrome-stable
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
RUN wget -O /tmp/chromedriver.zip https://chromedriver.storage.googleapis.com/`curl -sS chromedriver.storage.googleapis.com/LATEST_RELEASE`/chromedriver_linux64.zip && \
    unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/ && \
    rm /tmp/chromedriver.zip

ENV PATH=$NVM_DIR/versions/node/$NODE_VERSION/bin:$PATH
WORKDIR /root/
COPY package.json package-lock.json /root/
RUN npm install
COPY Gruntfile.js plugin.json tsconfig.json tslint.json karma.conf.js /root/
COPY src /root/src
COPY specs /root/specs
RUN grunt

FROM grafana/grafana:10.2.3 as prod
COPY --from=build /root/dist /var/lib/grafana/plugins/kairosdb
COPY docker/provisioning /etc/grafana/provisioning
COPY docker/dashboards  /var/lib/grafana/dashboards
