FROM node:24-alpine

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY server/src ./src
COPY web /app/web
COPY PGL-Players.txt /app/PGL-Players.txt

# Regenerate the final player database at build time.
RUN npm run gen:data

ENV NODE_ENV=production
ENV PORT=4321
ENV DB_PATH=/app/data/draftbox.sqlite

VOLUME ["/app/data"]
EXPOSE 4321

CMD ["node", "src/index.js"]
