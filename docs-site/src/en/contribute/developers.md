---
title: Developers
pageId: contribute-developer
order: 1
layout: layouts/page.njk
description: How you can help Covey as a developer.
---

We are building an open platform for civic support, and technical expertise is at the heart of our work. Security and accessibility are our guiding principles.

## Focus areas

### Security and privacy

Since we integrate with BankID and handle personal data, security is critical.

- Help us review the code for vulnerabilities.
- Implement secure authentication flows.
- Participate in designing the architecture to minimise data storage (privacy by design).

### Frontend and accessibility

The app must work on everything from old Android devices to the latest iPhones.

- Optimise performance and memory usage.
- Build responsive interfaces that follow accessibility standards (WCAG).
- Help with the PWA implementation.

### Integrations

- BankID integration (including test environments).
- API development for future third-party integrations.

## Tech stack

- **Frontend**: Preact 10 + Vite + Tailwind CSS + i18next + Socket.io + Leaflet
- **Backend**: Node 22 + Express 5 + Socket.io + PostgreSQL 16 + jose (JWT)
- **Infrastructure**: Docker Compose + Traefik + nginx
- **Testing**: node:test (backend), vitest (frontend)

## Get started

The source code is available on [Codeberg](https://codeberg.org/Sami-X-Lamti/Tillsammans). Clone the repository, read the developer documentation and open your first issue.
