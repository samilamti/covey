---
title: Tæknileg gagnsæi
pageId: transparency
order: 6
layout: layouts/page.njk
description: Yfirlit yfir tæknilega arkitektúr og hönnunarákvarðanir Covey.
---

## Opinn hugbúnaður

Allur frumkóði Covey er opinberlega aðgengilegur á [Codeberg](https://codeberg.org/Sami-X-Lamti/Tillsammans). Hver sem er getur skoðað, lagt til og byggt ofan á kóðann.

## Yfirlit yfir arkitektúr

Covey samanstendur af fjórum þjónustum sem vinna saman í gegnum Docker Compose:

| Þjónusta | Hlutverk |
|----------|----------|
| **Frontend** | Vefviðmót byggt á Preact, afgreitt af nginx |
| **Backend** | API og rauntímasamskipti með Express og Socket.io |
| **Gagnagrunnur** | PostgreSQL 16 fyrir gagnageymslu |
| **Traefik** | Öfugur þjónn með sjálfvirkri TLS-vottorðastjórnun |

## Hönnunarreglur

### Preact í stað React

Við notum Preact (3 KB) í stað React (40 KB) svo að forritið hleðst hratt jafnvel á eldri tækjum og hægum tengingum. API-ið er nánast eins.

### Progressive Web App (PWA)

Covey er dreift sem PWA -- engrar forritaverslunar er þörf. Settu upp beint úr vafranum, virkar utan nets fyrir grunnvirkni og fær push-tilkynningar eins og venjulegt forrit.

### Einföld eiginleikaflagga

Eiginleikar eru virkjaðir með umhverfisbreytum, ekki flóknum kerfum. Einfalt, áreiðanlegt og án ytri háðra.

### Skoðanakönnun fyrst fyrir samhæfni

Socket.io er stillt til að byrja á HTTP-skoðanakönnun og uppfæra svo í WebSocket. Þetta tryggir að eldri vafrar geti tengst beint.

### Kortun með OpenStreetMap

Við notum Leaflet með OpenStreetMap -- algjörlega ókeypis, enginn API-lykill þarf og opinn hugbúnaður.

### Vinnsla í ferli

Bakgrunnsverk (útrunnin beiðni, GDPR-eyðing) keyra sem áætluð ferli í sama Node-ferli -- engrar ytri verkaraðar er þörf.

## Gagnaflæði

1. **Kyrrstætt efni**: Vafri --> Traefik --> nginx --> HTML/JS/CSS
2. **API-köll**: Vafri --> Traefik --> Express --> PostgreSQL
3. **Rauntími**: Vafri --> Traefik --> Socket.io (uppfærist frá skoðanakönnun í WebSocket)

## CI/CD

Kóðageymsluhúsið er hýst á Codeberg með Woodpecker CI fyrir sjálfvirk próf og smíðar. Hver push keyrir backend- og frontend-próf og staðfestir að framleiðslusmíðin virki.

## Öryggisákvarðanir

- **JWT með HS256** -- Stöðulaus sannvottun með 24 klukkustunda gildistíma.
- **Dulnefni** -- BankID-nöfn eru aldrei sýnd sjálfkrafa.
- **Haversine í stað PostGIS** -- Einfaldara, léttara og nóg fyrir borgarmælikvarða.
- **Minnisgrunnuð hraðatakmörkun** -- Enginn Redis þarf fyrir eins þjóns uppsetningu.

## Hýsing

Covey er hýst á VPS hjá GleSYS í Stokkhólmi, knúið endurnýjanlegri orku. TLS-vottorð eru sjálfkrafa meðhöndluð af Let's Encrypt.
