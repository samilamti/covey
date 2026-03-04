---
title: Teknisk transparens
pageId: transparency
order: 6
layout: layouts/page.njk
description: Et overblik over Coveys tekniske arkitektur og designvalg.
---

## Aben kildekode

Al Coveys kildekode er abent tilgaengelig pa [Codeberg](https://codeberg.org/Sami-X-Lamti/Tillsammans). Hvem som helst kan gennemga, bidrage til og bygge videre pa koden.

## Arkitekturoverblik

Covey bestar af fire tjenester, der samarbejder via Docker Compose:

| Tjeneste | Rolle |
|----------|-------|
| **Frontend** | Webgraenseflade bygget med Preact, serveret via nginx |
| **Backend** | API og realtidskommunikation med Express og Socket.io |
| **Database** | PostgreSQL 16 til datalagring |
| **Traefik** | Omvendt proxy med automatisk TLS-certifikathndtering |

## Designprincipper

### Preact i stedet for React

Vi bruger Preact (3 KB) i stedet for React (40 KB), sa appen indlaeses hurtigt selv pa aeldre enheder og langsomme forbindelser. API'et er naesten identisk.

### Progressive Web App (PWA)

Covey distribueres som en PWA -- ingen app-butik nodvendig. Installer direkte fra browseren, fungerer offline til grundfunktioner og modtager push-notifikationer som en almindelig app.

### Enkel feature-flagning

Funktioner aktiveres via miljovariabler, ikke komplekse systemer. Enkelt, palideligt og uden eksterne afhaengigheder.

### Polling forst for kompatibilitet

Socket.io konfigureres til at starte med HTTP-polling og derefter opgradere til WebSocket. Dette garanterer, at aeldre browsere kan oprette forbindelse direkte.

### Kortgengivelse med OpenStreetMap

Vi bruger Leaflet med OpenStreetMap -- helt gratis, ingen API-nogle kraeves, og aben kildekode.

### In-proces-arbejdere

Baggrundsopgaver (udlob af anmodninger, GDPR-sletning) korer som planlagte processer i samme Node-proces -- ingen ekstern jobko nodvendig.

## Dataflow

1. **Statisk indhold**: Browser -> Traefik -> nginx -> HTML/JS/CSS
2. **API-kald**: Browser -> Traefik -> Express -> PostgreSQL
3. **Realtid**: Browser -> Traefik -> Socket.io (opgraderer fra polling til WebSocket)

## CI/CD

Koderepoen hostes pa Codeberg med Woodpecker CI til automatiserede tests og builds. Hvert push korer backend- og frontendtests samt verificerer, at produktionsbygget fungerer.

## Sikkerhedsbeslutninger

- **JWT med HS256** -- Tilstandslos autentificering med 24 timers udlobstid.
- **Pseudonyme navne** -- BankID-navne vises aldrig automatisk.
- **Omradenavne i stedet for koordinater** -- Kun omradenavne vises, ikke praecise GPS-koordinater.
- **Haversine i stedet for PostGIS** -- Enklere, lettere og tilstraekkeligt til byskala.
- **Hukommelsesbaseret hastighedsbegraensning** -- Ingen Redis nodvendig for en enkelt serverdistribution.

## Hosting

Covey hostes pa en VPS hos GleSYS i Stockholm, drevet af vedvarende energi. TLS-certifikater handteres automatisk via Let's Encrypt.
