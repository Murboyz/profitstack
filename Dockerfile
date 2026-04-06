FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY backend ./backend
COPY frontend ./frontend
COPY shared ./shared
COPY .env.example ./.env.example

EXPOSE 8787

CMD ["npm", "start"]
