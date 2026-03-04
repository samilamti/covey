---
title: Teknihkalaš čađatčielggasvuohta
pageId: transparency
order: 6
layout: layouts/page.njk
description: Oppalašgeahčastat Covey teknihkalaš arkitektuvrras ja hábmenávdnagiid mearrádusain.
---

## Rabas gáldu

Buot Covey gáldokodat leat rabasttit olahanlaččat [Codeberg](https://codeberg.org/Sami-X-Lamti/Tillsammans):s. Guhtege sáhttá geahčadit, oassálastit ja hukset viidáseappot koda alde.

## Arkitektuvraoppalašgeahčastat

Covey sisttisdoallá njealji bálvalusaid mat ovttasbargot Docker Compose bokte:

| Bálvalus | Doaibma |
|----------|--------|
| **Frontend** | Webbačalmmustat huksejuvvon Preact:ain, bálvaluvvon nginx bokte |
| **Backend** | API ja áigeguovdilis kommunikašuvdna Express ja Socket.io bokte |
| **Diehtovuođđu** | PostgreSQL 16 dieđuid vurkemii |
| **Traefik** | Nubbigežii proksy automáhtalaš TLS-sertifikáhtahálddahusain |

## Hábmenprinsihpat

### Preact React sajis

Mii geavahit Preact (3 KB) React (40 KB) sajis vai appa gárgá jođánit maiddái boarráset rusttegiiguin ja njoazás oktavuođaiguin. API lea measta identtalaš.

### Progressiivvalaš Webbaapl (PWA)

Covey juogaduvvo PWA:n -- ii dárbbaš appgávpi. Ásahit njuolga neahttaskáhppos, doaibmá offline vuođđodoaimmaide ja oažžu push-dieđáhusaid nugo dábálaš appa.

### Álki iešvuohtabelohkin

Iešvuođat aktiveruvvojit birasmuuttuhagaid bokte, eai keeralaš systemmaid. Álki, luohtehahtti ja olgguldas giehtalasaid haga.

### Polling-vuosttažettiin heivehanvuhtii

Socket.io konfiguruvvo álgit HTTP-pollingin ja de bajiduvvon WebSocketii. Dát dáhkida ahte boarráset neahttaskáhput sáhttet oktanit njuolga.

### Kárttačájeheapmi OpenStreetMap:ain

Mii geavahit Leaflet OpenStreetMap:ain -- ollásit nuvttá, ii API-čoavdda dárbbaš, ja rabas gáldu.

### Proseassa-siste bargit

Duogášdagut (gáibádusaid áigemeari nohkan, GDPR-sihkkun) čađahuvvojit skedulejuvvon proseassan seamma Node-proseassas -- ii olggobealde bargolinja dárbbaš.

## Dieđuidmannu

1. **Statihkalaš sisdoallu**: Neahttaskáhppu → Traefik → nginx → HTML/JS/CSS
2. **API-rávkkat**: Neahttaskáhppu → Traefik → Express → PostgreSQL
3. **Áigeguovdilis**: Neahttaskáhppu → Traefik → Socket.io (bajida pollingin rájes WebSocketii)

## CI/CD

Kodarepo leat Codeberg:s Woodpecker CI:in automáhtalaš testemiiguin ja huksemiiguin. Juohke push čađaha backend- ja frontend-testtaid ja duohtasta ahte produkšuvdnahuksen doaibmá.

## Oadjebasmearrádusat

- **JWT HS256:in** -- Stáhtuskeahtes duohtasteapmi 24 diimmu áigemeariin.
- **Suolálaš namat** -- BankID-namat eai goassege automáhtalaččat čájehuvvo.
- **Haversine PostGIS sajis** -- Álkit, geahnohut ja doarvái gávpotlávdadii.
- **Muittuvuođđuduvvon dássioainnusteapmi** -- Ii Redis dárbbaš ovtta servera distribušuvdnii.

## Hostigen

Covey leat hostejuvvon VPS:as GleSYS:s Stockholmas, doaimmahuvvon ođasmahtti energiijaiguin. TLS-sertifikáhtat hálddahuvvojit automáhtalaččat Let's Encrypt bokte.
