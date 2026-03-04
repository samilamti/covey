---
title: Teknisk transparens
pageId: transparency
order: 6
layout: layouts/page.njk
description: En översikt av Coveys tekniska arkitektur och designbeslut.
---

## Öppen källkod

All Coveys källkod är öppet tillgänglig på [Codeberg](https://codeberg.org/Sami-X-Lamti/Tillsammans). Vem som helst kan granska, bidra till och bygga vidare på koden.

## Arkitekturöversikt

Covey består av fyra tjänster som samverkar via Docker Compose:

| Tjänst | Roll |
|--------|------|
| **Frontend** | Webbgränssnitt byggt med Preact, serverat via nginx |
| **Backend** | API och realtidskommunikation med Express och Socket.io |
| **Databas** | PostgreSQL 16 för datalagring |
| **Traefik** | Omvänd proxy med automatisk TLS-certifikathantering |

## Designprinciper

### Preact istället för React

Vi använder Preact (3 KB) istället för React (40 KB) för att appen ska laddas snabbt även på äldre enheter och långsamma anslutningar. API:t är nästan identiskt.

### Progressive Web App (PWA)

Covey distribueras som en PWA — ingen appbutik behövs. Installera direkt från webbläsaren, fungerar offline för grundfunktioner, och får pushnotiser som en vanlig app.

### Enkel featureflaggning

Funktioner aktiveras via miljövariabler, inte komplexa system. Enkelt, pålitligt och utan externa beroenden.

### Polling-först för kompatibilitet

Socket.io konfigureras att starta med HTTP-polling och sedan uppgradera till WebSocket. Detta garanterar att äldre webbläsare kan ansluta direkt.

### Kartrendering med OpenStreetMap

Vi använder Leaflet med OpenStreetMap — helt gratis, ingen API-nyckel krävs, och öppen källkod.

### Inprocessarbetare

Bakgrundsuppgifter (utgång av förfrågningar, GDPR-radering) körs som schemalagda processer i samma Node-process — ingen extern jobbkö behövs.

## Dataflöde

1. **Statiskt innehåll**: Webbläsare → Traefik → nginx → HTML/JS/CSS
2. **API-anrop**: Webbläsare → Traefik → Express → PostgreSQL
3. **Realtid**: Webbläsare → Traefik → Socket.io (uppgraderar från polling till WebSocket)

## CI/CD

Kodrepot hostas på Codeberg med Woodpecker CI för automatiserade tester och byggen. Varje push kör backend- och frontendtester samt verifierar att produktionsbygget fungerar.

## Säkerhetsbeslut

- **JWT med HS256** — Stateless autentisering med 24 timmars utgångstid.
- **Pseudonyma namn** — BankID-namn visas aldrig automatiskt.
- **Haversine istället för PostGIS** — Enklare, lättare och tillräckligt för stadsskala.
- **Minnesbaserad hastighetsbegränsning** — Ingen Redis behövs för ett enda serverdistribution.

## Hosting

Covey hostas på en VPS hos GleSYS i Stockholm, drivet av förnybar energi. TLS-certifikat hanteras automatiskt via Let's Encrypt.
