FROM node:22-slim AS base

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm install

COPY . .

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/src/main"]