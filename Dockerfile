# =========================================
# Stage 1: Build the React.js Application
# =========================================
ARG NODE_VERSION=24-alpine

# Use a lightweight Node.js image for building (customizable via ARG)
FROM node:${NODE_VERSION} AS builder

LABEL org.opencontainers.image.source=https://github.com/SprintStartProject/sprintstart-frontend

# Node 24 can deadlock in process.exit() (nodejs/node#64274), which leaves `npm ci` or the build
# hanging after it finished. Every `node` here, npm included, runs without the two background
# compilers that trigger it; /usr/local/sbin comes before /usr/local/bin on the image's PATH, but
# the Alpine image does not create it.
RUN mkdir -p /usr/local/sbin \
    && printf '#!/bin/sh\nexec /usr/local/bin/node --no-maglev --no-concurrent-sparkplug "$@"\n' > /usr/local/sbin/node \
    && chmod +x /usr/local/sbin/node \
    && node -e 'process.exitCode = process.execArgv.includes("--no-maglev") ? 0 : 1'

# Set the working directory inside the container
WORKDIR /app

# Copy package-related files first to leverage Docker's caching mechanism
COPY package.json package-lock.json* ./

# Copy the rest of the application source code into the container
COPY . .

RUN npm install

# Install project dependencies using npm ci (ensures a clean, reproducible install)
RUN --mount=type=cache,target=/root/.npm npm ci

# Build the React.js application (outputs to /app/dist)
RUN npm run build


# =========================================
# Stage 2: Serve with nginx
# =========================================
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]