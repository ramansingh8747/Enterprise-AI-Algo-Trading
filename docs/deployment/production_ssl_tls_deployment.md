# Production SSL/TLS Deployment

## Overview
This document outlines the production requirements for secure HTTPS/WSS deployment.

## Prerequisites
- Domain name pointed to the production server.
- Reverse proxy (Nginx) installed.
- Let's Encrypt certificates generated via Certbot.

## TLS Configuration
1. **HTTPS (REST)**: Nginx is configured to terminate TLS and proxy requests to the FastAPI backend.
2. **WSS (WebSocket)**: Nginx is configured to proxy `/ws/` traffic and handle the `Upgrade` header for WebSocket connectivity.
3. **HTTP to HTTPS Redirect**: Nginx enforces a 301 redirect for all HTTP traffic.

## Certificate Management
- Certificates should be placed at: `/etc/letsencrypt/live/YOUR_DOMAIN/`
- Ensure the Nginx user has read access to the certificates.
- Use Certbot for automated renewal:
  ```bash
  certbot renew --post-hook "systemctl reload nginx"
  ```

## WebSocket Security
- Frontend `VITE_WS_URL` MUST be configured as `wss://YOUR_DOMAIN/ws/connect`.
- Nginx `proxy_read_timeout` is set to 86400 (24h) to keep WebSocket connections open.
