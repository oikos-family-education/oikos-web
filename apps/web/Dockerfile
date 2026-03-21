FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/

RUN npm install

COPY . .

EXPOSE 3000

ENV PORT 3000
ENV HOST 0.0.0.0

CMD ["npx", "turbo", "run", "dev", "--filter=web"]
