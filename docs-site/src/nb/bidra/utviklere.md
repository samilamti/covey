---
title: Utviklere
pageId: contribute-developer
order: 1
layout: layouts/page.njk
description: Hvordan du kan hjelpe Covey som utvikler.
---

Vi bygger en apen plattform for innbyggerstotte, og teknisk kompetanse er kjernen i arbeidet vart. Sikkerhet og tilgjengelighet er vare ledestjerner.

## Fokusomrader

### Sikkerhet og personvern

Siden vi integrerer med BankID og handterer personopplysninger er sikkerheten kritisk.

- Hjelp oss a granske koden for sarbarheter.
- Implementer sikre autentiseringsflyter.
- Delta i utformingen av arkitekturen for a minimere datalagring (privacy by design).

### Frontend og tilgjengelighet

Appen skal fungere pa alt fra gamle Android-enheter til nye iPhones.

- Optimaliser ytelse og minnebruk.
- Bygg responsive grensesnitt som folger tilgjengelighetsstandarder (WCAG).
- Hjelp med PWA-implementasjonen.

### Integrasjoner

- BankID-integrasjon (inkludert testmiljoer).
- API-utvikling for framtidige tredjepartsintegrasjoner.

## Teknologistabel

- **Frontend**: Preact 10 + Vite + Tailwind CSS + i18next + Socket.io + Leaflet
- **Backend**: Node 22 + Express 5 + Socket.io + PostgreSQL 16 + jose (JWT)
- **Infra**: Docker Compose + Traefik + nginx
- **Test**: node:test (backend), vitest (frontend)

## Kom i gang

Kildekoden finnes pa [GitHub](https://github.com/samilamti/covey). Klon repoet, les utviklerdokumentasjonen og apne din forste sak.
