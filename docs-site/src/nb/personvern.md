---
title: Personvern og GDPR
pageId: privacy
order: 3
layout: layouts/page.njk
description: Hvordan Covey beskytter personvernet ditt og oppfyller GDPR.
---

## Var personvernpolicy

Covey er bygget med personvern som grunnprinsipp. Vi samler inn sa lite data som mulig og sletter den sa snart den ikke lenger trengs.

## Dataminimering

### Personnummer (NIN)

Personnummeret ditt brukes utelukkende for a verifisere identiteten din via BankID. Det lagres **aldri i klartekst** -- bare som en kryptografisk hash (SHA-256). Dette betyr at ikke engang vi kan lese personnummeret ditt fra databasen.

### Posisjonsdata

Posisjonsdata deles bare under en aktiv okt og utelukkende med personen du koordinerer med. All posisjonsdata **slettes automatisk** fra databasen nar okten avsluttes gjennom en databasetrigger.

I apne foresporsler avrundes posisjonen din til omtrent 111 meters presisjon. Destinasjonen din vises aldri for andre for noen har akseptert foresporselen din.

### Pseudonyme visningsnavn

BankID-navnet ditt vises ikke for andre brukere. I stedet velger du selv et visningsnavn. BankID-verifiseringen finnes fortsatt bak kulissene for ansvarliggjoring.

## Dine rettigheter i henhold til GDPR

### Rett til dataportabilitet (Artikkel 20)

Du kan eksportere all din data via **Profil -> Eksporter data**. Eksporten inneholder:
- Din profil
- Dine hjelpeforesporsler
- Oktmeldinger
- Vurderinger og tilbakemeldinger
- Push-abonnementer

### Rett til sletting (Artikkel 17)

Du kan slette kontoen din via **Profil -> Slett konto**. Prosessen:

1. Kontoen markeres som slettet (myk sletting).
2. En 30-dagers betenkningstid gir deg mulighet til a angre.
3. Etter 30 dager slettes all data permanent av en automatisk bakgrunnsprosess.

## Sikkerhetsmodell

### Personvern og sikkerhet

| Trussel | Beskyttelsestiltak |
|---------|-------------------|
| Identifisere virkelige navn | Pseudonyme visningsnavn |
| Kryssreferere brukere | Profilen viser bare visningsnavn og verifiseringsstatus |
| Akseptere foresporsler for a naerme seg mal | Verifiseringsspor knytter BankID-verifiserte identiteter til hver okt |

### Tekniske beskyttelsestiltak

- **Kryptering under overforsel** -- All trafikk gar via HTTPS (TLS) med automatisk fornyede sertifikater.
- **Hashede personnummer** -- SHA-256, aldri i klartekst.
- **Efemer posisjonsdata** -- Slettes automatisk ved oktslutt.
- **Avrundede koordinater** -- ~111m presisjon i apne lister.
- **Skjulte destinasjoner** -- Vises aldri i apne foresporsler.
- **Hastighetsbegrensning** -- Beskytter mot misbruk av API-et.

## Ingen sporing, ingen reklame

Covey bruker ingen sporingscookies, ingen tredjepartsanalyser og ingen reklame. Vi selger aldri data. Plattformen finansieres gjennom donasjoner og frivillig arbeid.

## Kontakt

Hvis du har sporsmal om var databehandling, kontakt oss via [codeberg.org/Sami-X-Lamti/Tillsammans](https://codeberg.org/Sami-X-Lamti/Tillsammans).
