# syntax=docker/dockerfile:experimental
# export DOCKER_BUILDKIT=1

# build wizard
FROM node:10.15.3 as build-deps-wizard
WORKDIR /usr/src/wizard
COPY wizard .
RUN yarn
RUN rm -Rf build && yarn run buildproduction

# certificates
ADD "https://www.random.org/cgi-bin/randbyte?nbytes=10&format=h" skipcache
RUN mkdir /cert
RUN wget -O /cert/server.crt http://iso.ava.do/server.crt
RUN wget -O /cert/server.key  http://iso.ava.do/server.key
RUN echo "cert folder"
RUN ls  -l /cert

# build relayer
FROM alpine:3.11 as relayer-builder
WORKDIR /usr/src
RUN apk add -U git openssh yarn python build-base make nodejs npm g++

# RUN git clone https://github.com/AvadoDServer/tornado-relayer.git && \
RUN git clone https://github.com/tornadocash/tornado-relayer.git && \
    cd tornado-relayer && \
    git checkout tags/v4.1.0

WORKDIR /usr/src/tornado-relayer
RUN npm i

WORKDIR /usr/src/monitor
COPY monitor/* ./
RUN npm i && \
    npm cache clean --force


# build final image
FROM redis:alpine3.11
RUN mkdir /run/nginx
RUN chmod 777 /run/nginx
WORKDIR /usr/src/app
USER root
RUN apk add -U --no-cache nodejs npm yarn supervisor nginx
COPY --from=relayer-builder /usr/src/tornado-relayer /usr/src/tornado-relayer
WORKDIR /usr/src/tornado-relayer
RUN ls -l /usr/src/tornado-relayer
COPY --from=relayer-builder /usr/src/monitor /usr/src/monitor
COPY --from=build-deps-wizard /usr/src/wizard/build /usr/src/monitor/wizard
# RUN ls -lR /usr/src/
COPY files/supervisord.conf /etc/supervisord/
COPY files/nginx.conf /etc/nginx/
RUN mkdir -p /etc/nginx/certs/
COPY --from=build-deps-wizard /cert/server.crt /etc/nginx/certs/
COPY --from=build-deps-wizard /cert/server.key /etc/nginx/certs/
COPY files/startrelayer.sh /startrelayer.sh
RUN chmod +x /startrelayer.sh
ENTRYPOINT ["supervisord","-c","/etc/supervisord/supervisord.conf"]
