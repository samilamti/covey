---
title: Udviklere
pageId: contribute-developer
order: 1
layout: layouts/page.njk
description: Hvordan du kan hjaelpe Covey som udvikler.
---

Vi bygger en aben platform til borgerstotte, og teknisk kompetence er kernen i vores arbejde. Sikkerhed og tilgaengelighed er vores ledestjerner.

## Fokusomrader

### Sikkerhed og privatlivsbeskyttelse

Da vi integrerer med BankID og handterer personoplysninger, er sikkerheden kritisk.

- Hjaelp os med at gennemga koden for sarbarheder.
- Implementer sikre autentificeringsflows.
- Deltag i udformningen af arkitekturen for at minimere datalagring (privacy by design).

### Frontend og tilgaengelighed

Appen skal fungere pa alt fra gamle Android-enheder til nye iPhones.

- Optimer ydeevne og hukommelsesforbrug.
- Byg responsive graeenseflader, der folger tilgaengelighedsstandarder (WCAG).
- Hjaelp med PWA-implementeringen.

### Integrationer

- BankID-integration (inklusive testmiljoer).
- API-udvikling til fremtidige tredjepartsintegrationer.

## Teknologistak

- **Frontend**: Preact 10 + Vite + Tailwind CSS + i18next + Socket.io + Leaflet
- **Backend**: Node 22 + Express 5 + Socket.io + PostgreSQL 16 + jose (JWT)
- **Infra**: Docker Compose + Traefik + nginx
- **Test**: node:test (backend), vitest (frontend)

## Kom i gang

Kildekoden findes pa [Codeberg](https://codeberg.org/Sami-X-Lamti/Tillsammans). Klon repoen, laes udviklerdokumentationen og abn din forste sag.
