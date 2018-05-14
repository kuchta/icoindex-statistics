FROM node:8.11.3

RUN groupadd -r app && useradd -r -g app app
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json package-lock.json /usr/src/app/
RUN npm install -g npm@6.2.0
RUN npm ci

COPY ./src/. /usr/src/app/src
COPY ./testData/. /usr/src/app/testData

COPY tsconfig.json schema.gql config.json /usr/src/app/

RUN ./node_modules/typescript/bin/tsc --p . --strict
