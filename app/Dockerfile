FROM node:20-alpine AS base
WORKDIR /app
COPY package.json turbo.json ./
COPY packages/ ./packages/
COPY app/package.json ./app/
RUN npm install

FROM base AS builder
COPY app/ ./app/
RUN cd app && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]
