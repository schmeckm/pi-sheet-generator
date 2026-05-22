FROM node:20-alpine

RUN apk add --no-cache wget

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server ./
COPY docker/server/docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

ENV PORT=7000
EXPOSE 7000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:7000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
