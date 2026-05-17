FROM node:20-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY index.html package.json README.md ./
COPY src ./src
COPY docs ./docs
COPY scripts ./scripts
COPY server ./server

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/server.mjs"]
