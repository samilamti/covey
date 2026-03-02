FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Migrations run inline at startup (index.js calls migrate() before listening)
CMD ["node", "src/index.js"]

EXPOSE 3000
