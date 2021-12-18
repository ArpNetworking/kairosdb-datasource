from node:13 as build

workdir /root
run npm install -g grunt
add package.json package-lock.json /root
run npm install
add . /root
run grunt
run cp -R dist kairosdb-datasource
run zip -r kairosdb-datasource.zip kairosdb-datasource/

