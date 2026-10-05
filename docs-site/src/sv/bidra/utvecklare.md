---
title: Utvecklare
pageId: contribute-developer
order: 1
layout: layouts/page.njk
description: Hur du kan hjälpa Covey som utvecklare.
---

Vi bygger en öppen plattform för medborgarstöd, och teknisk kompetens är kärnan i vårt arbete. Säkerhet och tillgänglighet är våra ledord.

## Fokusområden

### Säkerhet och integritet

Eftersom vi integrerar med BankID och hanterar personuppgifter är säkerheten kritisk.

- Hjälp oss granska koden för sårbarheter.
- Implementera säkra autentiseringsflöden.
- Delta i utformningen av arkitekturen för att minimera datalagring (privacy by design).

### Frontend och tillgänglighet

Appen ska fungera på allt från gamla Android-enheter till nya iPhones.

- Optimera prestanda och minnesanvändning.
- Bygg responsiva gränssnitt som följer tillgänglighetsstandarder (WCAG).
- Hjälp med PWA-implementationen.

### Integrationer

- BankID-integration (inklusive testmiljöer).
- API-utveckling för framtida tredjepartsintegrationer.

## Teknikstack

- **Frontend**: Preact 10 + Vite + Tailwind CSS + i18next + Socket.io + Leaflet
- **Backend**: Node 22 + Express 5 + Socket.io + PostgreSQL 16 + jose (JWT)
- **Infra**: Docker Compose + Traefik + nginx
- **Test**: node:test (backend), vitest (frontend)

## Kom igång

Källkoden finns på [GitHub](https://github.com/samilamti/covey). Klona repot, läs utvecklardokumentationen och öppna ditt första ärende.
