---
title: Tekniskur sjónleiki
pageId: transparency
order: 6
layout: layouts/page.njk
description: Eitt yvirlit yvir tøkniligu bygnaðina og málsvarnar-avgerðir hjá Covey.
---

## Opin kelda

Allur keldukóðin hjá Covey er opið tøkur á [GitHub](https://github.com/samilamti/covey). Hvør sum er kann granska, veita framlag til og byggja á kóðanum.

## Bygnaðaryvirlit

Covey bestendur av fýra tænastum, sum samvirka gjøgnum Docker Compose:

| Tænasta | Leiklut |
|---------|---------|
| **Frontend** | Vebrúkarfláta bygd við Preact, skotin gjøgnum nginx |
| **Backend** | API og samtíðarsamskifti við Express og Socket.io |
| **Dátugrunnur** | PostgreSQL 16 til dátagoymingu |
| **Traefik** | Umvend proxy við sjálvvirkandi TLS-váttstøðustjóring |

## Málsvarnarprinsippir

### Preact í staðin fyri React

Vit brúka Preact (3 KB) í staðin fyri React (40 KB), soleiðis at appin innlesist skjótt, sjálvt á eldri tólum og seinkuligum sambondum. API-ið er nærum eins.

### Progressive Web App (PWA)

Covey verður útbytt sum ein PWA -- eingin appbúð er neyðug. Uppsett beinleiðis úr kaga, virkar offline fyri grundvirki, og fær push-fráboðanir sum ein vanlig app.

### Einføld flagging av eiginleikum

Eiginleikar verða virknað gjøgnum umhvørvisbreytistørrðir, ikki flóknar skipanir. Einfalt, trygt og uttan útvortis áheiting.

### Polling-fyrst fyri samhøvigleika

Socket.io verður stillt at byrja við HTTP-polling og síðan uppgreaða til WebSocket. Hetta tryggjar, at eldri kagar kunnu sambindast beinleiðis.

### Kortavísing við OpenStreetMap

Vit brúka Leaflet við OpenStreetMap -- heilt ókeypis, ongin API-lykil krevd, og opin kelda.

### Innprosessarbeiðarar

Bakgrundsarbeiðsuppgávur (útrenna bønir, GDPR-strikking) koyra sum skemalagdar prosessir í somu Node-prosessini -- ongin útvortis arbeiðslinja er neyðug.

## Dátuflóð

1. **Statiskt innihald**: Kagur → Traefik → nginx → HTML/JS/CSS
2. **API-kall**: Kagur → Traefik → Express → PostgreSQL
3. **Samtíð**: Kagur → Traefik → Socket.io (uppgreiðar frá polling til WebSocket)

## CI/CD

Keldukóðagoymslan verður hostað á GitHub við GitHub Actions fyri sjálvvirkandi royndir og bygd. Hvørt push koyrir backend- og frontend-royndir og staðfestir, at framleiðslubygdið virkar.

## Trygdaravgerðir

- **JWT við HS256** -- Statleys samgilding við 24 tíma útrennisfrístur.
- **Dulnevnd nøvn** -- BankID-nøvn verða aldrin sjálvvirknað víst.
- **Haversine í staðin fyri PostGIS** -- Einfaldari, léttari og nóg til bygdarskalanum.
- **Minnisgrundað hastigheitsbegring** -- Ongin Redis er neyðugur fyri eina einstaka miðaradreifingarskipan.

## Hosting

Covey verður hostað á einum VPS hjá GleSYS í Stokkhólmi, drivin av endurnýggjanlegari orku. TLS-váttstøður verða sjálvvirknað handfarnar gjøgnum Let's Encrypt.
