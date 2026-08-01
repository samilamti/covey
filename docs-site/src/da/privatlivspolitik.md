---
title: Privatlivspolitik og GDPR
pageId: privacy
order: 3
layout: layouts/page.njk
description: Hvordan Covey beskytter dit privatliv og overholder GDPR.
---

## Vores privatlivspolitik

Covey er bygget med privatlivsbeskyttelse som grundprincip. Vi indsamler sa lidt data som muligt og sletter den, sa snart den ikke laengere er nodvendig.

## Dataminimering

### Personnummer (NIN)

Dit personnummer bruges udelukkende til at verificere din identitet via BankID. Det lagres **aldrig i klartekst** -- kun som en kryptografisk hash (SHA-256). Det betyder, at ikke engang vi kan laese dit personnummer fra databasen.

### Positionsdata

Positionsdata deles kun under en aktiv session og udelukkende med den person, du koordinerer med. Alle positionsdata **slettes automatisk** fra databasen, nar sessionen afsluttes, via en databasetrigger.

I abne anmodninger afrundes din position til cirka 111 meters praecision. Din destination vises aldrig for andre, for nogen har accepteret din anmodning.

### Pseudonyme visningsnavne

Dit BankID-navn vises ikke for andre brugere. I stedet vaelger du selv et visningsnavn. BankID-verificeringen findes stadig bag kulisserne for ansvarspligt.

## Dine rettigheder i henhold til GDPR

### Ret til dataportabilitet (Artikel 20)

Du kan eksportere alle dine data via **Profil -> Eksporter data**. Eksporten indeholder:
- Din profil
- Dine hjaelpeanmodninger
- Sessionsbeskeder
- Vurderinger og anmeldelser
- Push-abonnementer

### Ret til sletning (Artikel 17)

Du kan slette din konto via **Profil -> Slet konto**. Processen:

1. Kontoen markeres som slettet (blod sletning).
2. En 30-dages betaenkningstid giver dig mulighed for at fortryde.
3. Efter 30 dage slettes alle data permanent af en automatisk baggrundsproces.

## Sikkerhedsmodel

### Privatliv og sikkerhed

| Trussel | Beskyttelsesforanstaltning |
|---------|---------------------------|
| Identificere rigtige navne | Pseudonyme visningsnavne |
| Krydsreferere brugere | Profilen viser kun visningsnavn og verificeringsstatus |
| Acceptere anmodninger for at naerme sig mal | Verificeringsspor knytter BankID-verificerede identiteter til hver session |

### Tekniske beskyttelsesforanstaltninger

- **Kryptering under transport** -- Al trafik gar via HTTPS (TLS) med automatisk fornyede certifikater.
- **Hashede personnumre** -- SHA-256, aldrig i klartekst.
- **Efemer positionsdata** -- Slettes automatisk ved sessionsafslutning.
- **Afrundede koordinater** -- ~111m praecision i abne lister.
- **Skjulte destinationer** -- Vises aldrig i abne anmodninger.
- **Hastighedsbegraensning** -- Beskytter mod misbrug af API'et.

## Ingen sporing, ingen reklame

Covey bruger ingen sporingscookies, ingen analyser fra tredjepart og ingen reklame. Vi sælger aldrig data. Tjenesten er gratis at bruge, og indtægtsmodellen bygger aldrig på dine oplysninger.

## Kontakt

Hvis du har sporgsmal om vores databehandling, kontakt os via [codeberg.org/Sami-X-Lamti/Tillsammans](https://codeberg.org/Sami-X-Lamti/Tillsammans).
