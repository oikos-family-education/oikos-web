FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY turbo.json ./
COPY packages/ ./packages/
COPY apps/admin/package.json ./apps/admin/

RUN npm install

COPY . .

EXPOSE 3001

ENV PORT 3001
ENV HOST 0.0.0.0

CMD ["npx", "turbo", "run", "dev", "--filter=admin"]
