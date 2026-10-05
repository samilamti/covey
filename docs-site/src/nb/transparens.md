---
title: Teknisk transparens
pageId: transparency
order: 6
layout: layouts/page.njk
description: En oversikt over Coveys tekniske arkitektur og designvalg.
---

## Apen kildekode

All Coveys kildekode er apent tilgjengelig pa [GitHub](https://github.com/samilamti/covey). Hvem som helst kan granske, bidra til og bygge videre pa koden.

## Arkitekturoversikt

Covey bestar av fire tjenester som samarbeider via Docker Compose:

| Tjeneste | Rolle |
|----------|-------|
| **Frontend** | Webgrensesnitt bygget med Preact, servert via nginx |
| **Backend** | API og sanntidskommunikasjon med Express og Socket.io |
| **Database** | PostgreSQL 16 for datalagring |
| **Traefik** | Omvendt proxy med automatisk TLS-sertifikathandtering |

## Designprinsipper

### Preact i stedet for React

Vi bruker Preact (3 KB) i stedet for React (40 KB) slik at appen laster raskt selv pa eldre enheter og trege forbindelser. API-et er nesten identisk.

### Progressive Web App (PWA)

Covey distribueres som en PWA -- ingen appbutikk trengs. Installer direkte fra nettleseren, fungerer offline for grunnfunksjoner, og mottar pushvarsler som en vanlig app.

### Enkel funksjonsbryter

Funksjoner aktiveres via miljovariabler, ikke komplekse systemer. Enkelt, palitelig og uten eksterne avhengigheter.

### Polling forst for kompatibilitet

Socket.io konfigureres til a starte med HTTP-polling og deretter oppgradere til WebSocket. Dette garanterer at eldre nettlesere kan koble til direkte.

### Kartgjengivelse med OpenStreetMap

Vi bruker Leaflet med OpenStreetMap -- helt gratis, ingen API-nokkel kreves, og apen kildekode.

### Inprosess-arbeidere

Bakgrunnsoppgaver (utlop av foresporsler, GDPR-sletting) kjores som planlagte prosesser i samme Node-prosess -- ingen ekstern jobbko trengs.

## Dataflyt

1. **Statisk innhold**: Nettleser -> Traefik -> nginx -> HTML/JS/CSS
2. **API-kall**: Nettleser -> Traefik -> Express -> PostgreSQL
3. **Sanntid**: Nettleser -> Traefik -> Socket.io (oppgraderer fra polling til WebSocket)

## CI/CD

Koderepoet hostes pa GitHub med GitHub Actions for automatiserte tester og bygg. Hvert push kjorer backend- og frontendtester samt verifiserer at produksjonsbygget fungerer.

## Sikkerhetsbeslutninger

- **JWT med HS256** -- Tilstandslos autentisering med 24 timers utlopstid.
- **Pseudonyme navn** -- BankID-navn vises aldri automatisk.
- **Omradenavn i stedet for koordinater** -- Bare omradenavn vises, ikke eksakte GPS-koordinater.
- **Haversine i stedet for PostGIS** -- Enklere, lettere og tilstrekkelig for byskala.
- **Minnebasert hastighetsbegrensning** -- Ingen Redis trengs for en enkelt serverdistribusjon.

## Hosting

Covey hostes pa en VPS hos GleSYS i Stockholm, drevet av fornybar energi. TLS-sertifikater handteres automatisk via Let's Encrypt.
