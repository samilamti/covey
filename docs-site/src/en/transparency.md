---
title: Technical transparency
pageId: transparency
order: 6
layout: layouts/page.njk
description: An overview of Covey's technical architecture and design decisions.
---

## Open source

All of Covey's source code is publicly available on [Codeberg](https://codeberg.org/Sami-X-Lamti/Tillsammans). Anyone can review, contribute to and build upon the code.

## Architecture overview

Covey consists of four services that work together via Docker Compose:

| Service | Role |
|---------|------|
| **Frontend** | Web interface built with Preact, served via nginx |
| **Backend** | API and real-time communication with Express and Socket.io |
| **Database** | PostgreSQL 16 for data storage |
| **Traefik** | Reverse proxy with automatic TLS certificate management |

## Design principles

### Preact instead of React

We use Preact (3 KB) instead of React (40 KB) so that the app loads quickly even on older devices and slow connections. The API is nearly identical.

### Progressive Web App (PWA)

Covey is delivered as a PWA -- no app store needed. Install directly from the browser, basic features work offline, and push notifications work just like a native app.

### Simple feature flagging

Features are toggled through environment variables, not complex systems. Simple, reliable and with no external dependencies.

### Polling-first for compatibility

Socket.io is configured to start with HTTP polling and then upgrade to WebSocket. This ensures that older browsers can connect straight away.

### Map rendering with OpenStreetMap

We use Leaflet with OpenStreetMap -- completely free, no API key required, and open source.

### In-process workers

Background tasks (request expiration, GDPR deletion) run as scheduled processes within the same Node process -- no external job queue needed.

## Data flow

1. **Static content**: Browser -> Traefik -> nginx -> HTML/JS/CSS
2. **API calls**: Browser -> Traefik -> Express -> PostgreSQL
3. **Real-time**: Browser -> Traefik -> Socket.io (upgrades from polling to WebSocket)

## CI/CD

The code repository is hosted on Codeberg with Woodpecker CI for automated tests and builds. Every push runs backend and frontend tests and verifies that the production build succeeds.

## Security decisions

- **JWT with HS256** -- Stateless authentication with a 24-hour expiry.
- **Administrator-approved membership** -- Community membership requires manual approval.
- **Pseudonymous names** -- BankID names are never shown automatically.
- **Area names instead of coordinates** -- Communities show "Sodermalm", not exact GPS coordinates.
- **Haversine instead of PostGIS** -- Simpler, lighter and sufficient for city-scale distances.
- **In-memory rate limiting** -- No Redis needed for a single-server deployment.

## Hosting

Covey is hosted on a VPS at GleSYS in Stockholm, powered by renewable energy. TLS certificates are managed automatically via Let's Encrypt.
