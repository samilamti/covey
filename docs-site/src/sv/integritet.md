---
title: Integritet & GDPR
pageId: privacy
order: 3
layout: layouts/page.njk
description: Hur Covey skyddar din integritet och uppfyller GDPR.
---

## Vår integritetspolicy

Covey är byggt med integritet som grundprincip. Vi samlar in så lite data som möjligt och raderar den så snart den inte längre behövs.

## Dataminimering

### Personnummer (NIN)

Ditt personnummer används enbart för att verifiera din identitet via BankID. Det lagras **aldrig i klartext** — bara som en kryptografisk hash (SHA-256). Detta innebär att inte ens vi kan läsa ditt personnummer från databasen.

### Platsdata

Platsdata delas bara under en aktiv session och enbart med den person du koordinerar med. All platsdata **raderas automatiskt** från databasen när sessionen avslutas genom en databastrigger.

I öppna förfrågningar avrundas din position till cirka 111 meters precision. Din destination visas aldrig för andra förrän någon har accepterat din förfrågan.

### Pseudonyma visningsnamn

Ditt BankID-namn visas inte för andra användare. Istället väljer du själv ett visningsnamn. BankID-verifieringen finns kvar bakom kulisserna för ansvarsskyldighet.

## Dina rättigheter enligt GDPR

### Rätt till dataportabilitet (Artikel 20)

Du kan exportera all din data via **Profil → Exportera data**. Exporten innehåller:
- Din profil
- Dina hjälpförfrågningar
- Sessionsmeddelanden
- Betyg och omdömen
- Push-prenumerationer

### Rätt till radering (Artikel 17)

Du kan radera ditt konto via **Profil → Radera konto**. Processen:

1. Kontot markeras som raderat (mjuk radering).
2. En 30-dagars betänketid ger dig möjlighet att ångra beslutet.
3. Efter 30 dagar raderas all data permanent av en automatisk bakgrundsprocess.

## Säkerhetsmodell

| Hot | Skyddsåtgärd |
|-----|-------------|
| Identifiera riktiga namn | Pseudonyma visningsnamn |
| Korsreferera användare | Profilen visar bara visningsnamn och verifieringsstatus |
| Acceptera förfrågningar för att närma sig mål | Verifieringsspår knyter BankID-verifierade identiteter till varje session |

### Tekniska skyddsåtgärder

- **Kryptering i transit** — All trafik går via HTTPS (TLS) med automatiskt förnyade certifikat.
- **Hashade personnummer** — SHA-256, aldrig i klartext.
- **Efemär platsdata** — Raderas automatiskt vid sessionsslut.
- **Avrundade koordinater** — ~111m precision i öppna listor.
- **Dolda destinationer** — Visas aldrig i öppna förfrågningar.
- **Hastighetsbegränsning** — Skyddar mot missbruk av API:et.

## Ingen spårning, ingen reklam

Covey använder inga spårningscookies, inga analyser från tredje part och ingen reklam. Vi säljer aldrig data. Tjänsten är gratis att använda, och intäktsmodellen bygger aldrig på dina uppgifter.

## Kontakt

Om du har frågor om vår databehandling, kontakta oss via [github.com/samilamti/covey](https://github.com/samilamti/covey).
