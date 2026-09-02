FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Nessuna direttiva VOLUME qui: su Railway il volume persistente si
# collega dall'interfaccia (Settings → Volumes, mount path /app/dati),
# non nel Dockerfile. Senza quel collegamento, ogni riavvio del
# container perde le sessioni WhatsApp di TUTTI gli studi, e ognuno deve
# riscansionare il QR da capo.

EXPOSE 8080
CMD ["node", "dist/index.js"]
