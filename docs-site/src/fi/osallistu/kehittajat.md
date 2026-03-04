---
title: Kehittäjät
pageId: contribute-developer
order: 1
layout: layouts/page.njk
description: Miten voit auttaa Coveyta kehittäjänä.
---

Rakennamme avointa alustaa kansalaisavulle, ja tekninen osaaminen on työmme ydin. Turvallisuus ja saavutettavuus ovat avainsanojamme.

## Painopistealueet

### Turvallisuus ja yksityisyys

Koska integroimme BankID:n kanssa ja käsittelemme henkilötietoja, turvallisuus on kriittistä.

- Auta meitä tarkastamaan koodi haavoittuvuuksien varalta.
- Toteuta turvallisia tunnistautumisprosesseja.
- Osallistu arkkitehtuurin suunnitteluun tietojen tallennuksen minimoimiseksi (privacy by design).

### Frontend ja saavutettavuus

Sovelluksen tulee toimia kaikessa vanhoista Android-laitteista uusimpiin iPhoneihin.

- Optimoi suorituskyky ja muistinkäyttö.
- Rakenna responsiivisia käyttöliittymiä, jotka noudattavat saavutettavuusstandardeja (WCAG).
- Auta PWA-toteutuksessa.

### Integraatiot

- BankID-integraatio (mukaan lukien testiympäristöt).
- API-kehitys tulevia kolmannen osapuolen integraatioita varten.

## Teknologiapino

- **Frontend**: Preact 10 + Vite + Tailwind CSS + i18next + Socket.io + Leaflet
- **Backend**: Node 22 + Express 5 + Socket.io + PostgreSQL 16 + jose (JWT)
- **Infra**: Docker Compose + Traefik + nginx
- **Testit**: node:test (backend), vitest (frontend)

## Aloita

Lähdekoodi löytyy [Codebergista](https://codeberg.org/Sami-X-Lamti/Tillsammans). Kloonaa repo, lue kehittäjädokumentaatio ja avaa ensimmäinen tikettisi.
