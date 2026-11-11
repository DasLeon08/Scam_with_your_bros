# Game server for "Scam with your Bros" (the game itself is a static build that goes to Toki).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY shared shared
COPY server server
RUN npm run build -w server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NO_DOTENV=1 PORT=8787
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/node_modules/ws ./node_modules/ws
EXPOSE 8787
USER node
HEALTHCHECK CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["node", "dist/main.js"]
