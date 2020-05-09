# build relayer
FROM alpine:3.11 as relayer-builder

WORKDIR /usr/src/app

RUN apk add -U git nodejs npm python build-base make g++

RUN git clone https://github.com/tornadocash/relayer.git && \
    cd relayer && \ 
    git checkout tags/2.5 && \
    npm i web3@1.2.4 && \
    npm i web3-utils@1.2.4 && \
    npm i && \
    npm cache clean --force

WORKDIR /usr/src/monitor

COPY monitor/* ./

RUN npm i && \
    npm cache clean --force

FROM node:10.15.3 as build-deps-wizard

# build wizard
WORKDIR /usr/src/app
COPY wizard .
RUN yarn
RUN rm -Rf build && yarn run build

# build final image
FROM redis:alpine3.11

WORKDIR /usr/src/app
USER root

RUN apk add -U --no-cache nodejs supervisor

COPY --from=relayer-builder /usr/src/app /usr/src/app
COPY --from=relayer-builder /usr/src/monitor /usr/src/monitor
COPY --from=build-deps-wizard /usr/src/app/build /usr/src/monitor/wizard
RUN ls -lR /usr/src/monitor/wizard
COPY supervisord.conf /etc/supervisord/

ENTRYPOINT ["supervisord","-c","/etc/supervisord/supervisord.conf"]
