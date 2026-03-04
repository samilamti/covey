---
title: Teknikkikkut nalunaarutigiinnarneq
pageId: transparency
order: 6
layout: layouts/page.njk
description: Covey-p teknikkeqarfigisaanik aamma pilersaarusiorfigisaanik takutinnagaq.
---

## Ammarluinnaq koodit

Covey-p koodit tamarmik ammarluinnarpput [Codeberg](https://codeberg.org/Sami-X-Lamti/Tillsammans)-imi. Kinaassaaq misissuisinnaavaa, ilaasortaasinnaalluni aammalu sillimasinnaallugu.

## Pisortat yvirlit

Covey-p sisamanik suliniuteqarfigisaanik Docker Compose aqqutigalugu:

| Suliniut | Suliat |
|----------|--------|
| **Frontend** | Webbimik atuifik Preact-imik, nginx-imik |
| **Backend** | API aamma ataatsimut oqaloqateqarneq Express aamma Socket.io aqqutigalugu |
| **Database** | PostgreSQL 16 daatat toqqorsinnaanermut |
| **Traefik** | Proxy TLS-certificatit nammineq akuersissuteqarlugu |

## Pilersaaruserneq

### Preact React-ip inaani

Preact-imik atuippoq (3 KB), React (40 KB) inaani, taamaalilluni app nalinginnaasumik atuisoqarsinnaassalluni suliassarsiorsinnaanngitsunillu.

### Progressive Web App (PWA)

Covey-p PWA-mik nassiunneqarpoq -- appbutik piariaqanngillaq. Browsernit nammineq nassiunneqarsinnaalluni, offlinimik suliniuteqarsinnaalluni, aamma push-mik nalunaarsoqqulersitsisinnaalluni.

### Pissusilersuutit flagginneqarnerit

Pissusilersuutit miljø-breytistørrðitigut atuisoqarpput, flóknar skipanirngillat. Pitsaassumik, uppernarsarsimassumik aamma avanermiuunatigut.

### Polling-mik siullermeerpoq

Socket.io-p HTTP-polling-imik aallartikkaanni WebSocket-imut nutarterneqassalluni. Taamaalilluni browsinnit nutaanngitsut isissagassapput.

### Nunap assinga OpenStreetMap aqqutigalugu

Leaflet-imik OpenStreetMap-imillu atuipput -- akiitsumik, API-keymik piariaqanngillaq, aamma ammarluinnaq.

### Suliniuteqarfik nammineq

Bakgrunnimik suliassat (qinnuteqaatit naammassinerit, GDPR-peernerit) Node-p nammineq prosessiatigut -- suliniuteqarfilik avannarliuneq piariaqanngillaq.

## Daatat qanoq atuineqartiginerat

1. **Statiskimik innihald**: Browser → Traefik → nginx → HTML/JS/CSS
2. **API-kald**: Browser → Traefik → Express → PostgreSQL
3. **Ataatsimut**: Browser → Traefik → Socket.io (polling-imit WebSocket-imut)

## CI/CD

Koodit Codeberg-imi Woodpecker CI-millu testit aamma buildingit nammineq. Push tamarmik backend- aamma frontend-testit atuisinnaapput aamma productionsbuildingit uppernarsaanerlugit.

## Aaqqiissutaasut isumaliutit

- **JWT HS256-imik** -- Stateless-imik samgildeq 24 tiimini naammassilluni.
- **Angajoqqaarmit akuersissuteqartoq** -- Peqatigiiffinni ilaasortanissaq akuersissuteqartariaqarpoq.
- **Attaviusut atit** -- BankID-p atia nammineq takutinneqanngillaq.
- **Najugaqarfittut atit koordinatinngillat** -- Peqatigiiffiit "Södermalm" takutippaat, GPS-koordinatinngilaq.
- **Haversine PostGIS-ip inaani** -- Pitsaassumik, sukumiisumik aamma bygdinut naammassimasoq.
- **Eqqissimanermik killeqquneqarneq** -- Redis piariaqanngillaq servarimut ataatsimut.

## Hosting

Covey-p GleSYS-ip VPS-iatigut Stockholm-imi hostinneqarpoq, nukissioqqut atuisoqarsinnaanngitsut aqqutigalugit. TLS-certificatit Let's Encrypt-imik nammineq akuersissuteqarlugu.
