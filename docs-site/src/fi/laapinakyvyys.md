---
title: Tekninen läpinäkyvyys
pageId: transparency
order: 6
layout: layouts/page.njk
description: Yleiskatsaus Coveyn tekniseen arkkitehtuuriin ja suunnittelupäätöksiin.
---

## Avoin lähdekoodi

Kaikki Coveyn lähdekoodi on avoimesti saatavilla [GitHubissa](https://github.com/samilamti/covey). Kuka tahansa voi tarkastella, osallistua ja rakentaa koodin pohjalta.

## Arkkitehtuurin yleiskatsaus

Covey koostuu neljästä palvelusta, jotka toimivat yhdessä Docker Composen kautta:

| Palvelu | Rooli |
|---------|-------|
| **Frontend** | Preactilla rakennettu web-käyttöliittymä, tarjoiltu nginx:llä |
| **Backend** | API ja reaaliaikainen viestintä Expressillä ja Socket.io:lla |
| **Tietokanta** | PostgreSQL 16 tietojen tallennukseen |
| **Traefik** | Käänteinen välityspalvelin automaattisella TLS-varmenteen hallinnalla |

## Suunnitteluperiaatteet

### Preact Reactin sijaan

Käytämme Preactia (3 kt) Reactin (40 kt) sijaan, jotta sovellus latautuu nopeasti myös vanhemmilla laitteilla ja hitailla yhteyksillä. API on lähes identtinen.

### Progressive Web App (PWA)

Covey jaetaan PWA:na -- sovelluskauppaa ei tarvita. Asenna suoraan selaimesta, toimii offline-perustoiminnoissa ja saa push-ilmoituksia tavallisen sovelluksen tavoin.

### Yksinkertainen ominaisuuslippujen hallinta

Ominaisuudet aktivoidaan ympäristömuuttujilla, ei monimutkaisilla järjestelmillä. Yksinkertaista, luotettavaa ja ilman ulkoisia riippuvuuksia.

### Polling ensin yhteensopivuuden vuoksi

Socket.io on konfiguroitu aloittamaan HTTP-pollauksella ja päivittämään sitten WebSocketiin. Tämä takaa, että vanhemmat selaimet voivat yhdistää suoraan.

### Karttojen renderöinti OpenStreetMapilla

Käytämme Leafletia OpenStreetMapin kanssa -- täysin ilmainen, ei API-avainta tarvita, ja avointa lähdekoodia.

### Prosessin sisäiset työntekijät

Taustatehtävät (pyyntöjen vanheneminen, GDPR-poisto) ajetaan ajastettuina prosesseina samassa Node-prosessissa -- erillistä työjonoa ei tarvita.

## Tietovirta

1. **Staattinen sisältö**: Selain --> Traefik --> nginx --> HTML/JS/CSS
2. **API-kutsut**: Selain --> Traefik --> Express --> PostgreSQL
3. **Reaaliaikainen**: Selain --> Traefik --> Socket.io (päivittyy pollauksesta WebSocketiin)

## CI/CD

Koodirepo sijaitsee GitHubissa ja käyttää GitHub Actions:tä automatisoituihin testeihin ja rakennuksiin. Jokainen push ajaa backend- ja frontend-testit sekä varmistaa, että tuotantorakennelma toimii.

## Turvallisuuspäätökset

- **JWT ja HS256** -- Tilaton tunnistautuminen 24 tunnin vanhenemisajalla.
- **Pseudonyymit nimet** -- BankID-nimiä ei koskaan näytetä automaattisesti.
- **Aluenimet koordinaattien sijaan** -- Vain aluenimet näytetään, ei tarkkoja GPS-koordinaatteja.
- **Haversine PostGIS:n sijaan** -- Yksinkertaisempi, kevyempi ja riittävä kaupunkimittakaavaan.
- **Muistipohjainen nopeusrajoitus** -- Redis-palvelinta ei tarvita yksittäisen palvelimen käyttöönotossa.

## Hosting

Covey toimii GleSYS:n VPS-palvelimella Tukholmassa, uusiutuvalla energialla. TLS-varmenteet hoidetaan automaattisesti Let's Encryptin kautta.
