FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

# regenerate the final player database at build time
RUN node src/data/generate-teams-from-txt.js

ENV NODE_ENV=production
ENV PORT=4321
ENV DB_PATH=/app/data/draftbox.sqlite

VOLUME ["/app/data"]
EXPOSE 4321

CMD ["node", "src/index.js"]
