# Image unique pour web, api et worker (la commande change selon le service).
FROM node:22-alpine
RUN corepack enable && apk add --no-cache openssl
WORKDIR /app
COPY . .
# pnpm-lock.yaml doit être commité (voir README).
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi && pnpm db:generate
ARG NEXT_PUBLIC_SOLANA_RPC_URL
ARG NEXT_PUBLIC_WALK_DECIMALS=6
ARG NEXT_PUBLIC_WALK_MINT=
ARG NEXT_PUBLIC_BUY_URL=
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ARG NEXT_PUBLIC_CONTACT_EMAIL=
RUN pnpm --filter @walk/web build
ENV NODE_ENV=production
# Le processus ne tourne pas en root.
RUN chown -R node:node /app
USER node
