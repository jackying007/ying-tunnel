FROM oven/bun:alpine AS base

FROM base AS server
WORKDIR /app
COPY apps/server/dist/main.js ./dist/main.js
COPY apps/server/static ./static
EXPOSE $ADMIN_API_PORT
EXPOSE $TUNNEL_SERVER_PORT
EXPOSE $PROXY_SERVER_PORT
CMD ["bun", "dist/main.js"]