# syntax=docker/dockerfile:1
FROM node:24-alpine

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the application source.
COPY . .

# Persist the CSV outside the image so data survives container restarts.
ENV NODE_ENV=production
ENV PORT=3000
ENV BOOKS_CSV=/data/books.csv

# Create /data owned by the non-root `node` user. A fresh named volume mounted
# here inherits this ownership, so the app can write books.csv. Without this the
# volume is root-owned and every write fails with EACCES (HTTP 500).
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]

EXPOSE 3000

# Drop to the built-in non-root user for safety.
USER node

CMD ["node", "server.js"]
