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
VOLUME ["/data"]

EXPOSE 3000

# Drop to the built-in non-root user for safety.
USER node

CMD ["node", "server.js"]
