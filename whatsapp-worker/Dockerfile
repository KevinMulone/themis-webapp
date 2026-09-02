FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Il volume persistente dell'host va montato qui: se non lo è, ogni
# riavvio del container perde le sessioni WhatsApp di TUTTI gli studi, e
# ognuno deve riscansionare il QR da capo.
VOLUME ["/app/dati"]

EXPOSE 8080
CMD ["node", "dist/index.js"]
