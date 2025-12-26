FROM node:latest

WORKDIR /usr/src/app

COPY . .

RUN apt-get update && \
    apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev && \
    npm install -g node-gyp

RUN if [ -d "node_modules" ]; then \
        npm list --depth=0 2>&1 | grep -q "missing" && \
        npm install || \
        true; \
    else \
        npm install; \
    fi

CMD [ "npm", "start" ]