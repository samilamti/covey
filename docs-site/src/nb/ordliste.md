---
title: Ordliste
pageId: glossary
order: 5
layout: layouts/page.njk
description: Forklaring av viktige begreper som brukes i Covey.
---

## Grunnleggende begreper

### Hjelpeforesporsels

En tidsbegrenset foresporsels om sikkerhetsstotte i virkeligheten -- for eksempel "Jeg trenger noen a ga hjem med." Opprettes av en **foresporsler** og utfores av en **hjelper**.

### Foresporsler

Den som oppretter en hjelpeforesporsels. Personen soker trygghetsstotte, for eksempel en gangfolge.

### Hjelper

Den som aksepterer og utforer en hjelpeforesporsels. Ma oppfylle kvalifikasjonskrav for godkjenning. Under en aktiv okt deler begge parter sin posisjon i sanntid.

### Okt

Den aktive fasen av en hjelpeforesporsels, fra godkjenning til avslutning. Under en okt kan foresporsler og hjelper utveksle meldinger og dele posisjon.

## Kvalifikasjon og trygghet

### Kvalifikasjonsniva

Styrer hvem som kan se og akseptere en foresporsels. Tre nivaer finnes:

| Niva | Regel | Beskrivelse |
|------|-------|-------------|
| **Lignende som meg** | Samme kjonn OG fodselsar +-5 | Standard. Matcher personer av lignende alder og kjonn. |
| **Kvalifiserte ledsagere** | Demografisk matching ELLER trygghetspoengsum >= 5 | Apner for erfarne hjelpere. |
| **Alle medlemmer** | Ingen begrensninger | Alle verifiserte brukere kan akseptere. |

### Trygghetspoengsum

En akkumulert poengsum basert pa vurderinger etter avsluttede okter. Nye brukere starter pa 0. En poengsum pa 5 eller hoyere kvalifiserer som **kvalifisert ledsager**.

### Kvalifisert ledsager

En bruker hvis trygghetspoengsum nar terskelverdien (for oyeblikket 5). Kan akseptere foresporsler pa nivaet "Kvalifiserte ledsagere" selv uten demografisk matching.

## Identitet og autentisering

### BankID

Norges og Sveriges nasjonale elektroniske identifiseringssystem. Brukes for sikker innlogging i Covey.

### Personnummer (NIN)

Svensk personnummer i formatet YYYYMMDDXXXX. Brukes for BankID-verifisering. Lagres **aldri i klartekst** -- bare som kryptografisk hash.

## Posisjon og geografi

### Sanntidsposisjonsdeling

Deling av posisjon mellom foresporsler og hjelper under en aktiv okt. Hastighetsbegrenset til en oppdatering hvert femte sekund. All posisjonsdata slettes nar okten avsluttes.

### Beregnet ankomsttid (ETA)

Beregning av omtrentlig tid til mote basert pa luftlinjeavstand med antatt ganghastighet (5 km/t).

## Foresporselsens livssyklus

En hjelpeforesporsels gar gjennom folgende statuser:

| Status | Betydning |
|--------|-----------|
| **Apen** | Venter pa hjelper. Synlig i lister basert pa kvalifikasjon. |
| **Akseptert** | Hjelper tildelt. Meldinger aktivert. |
| **Aktiv** | Okt pagar. Posisjonsdeling aktiv. |
| **Avsluttes** | En part har markert ferdig, venter pa bekreftelse. |
| **Avsluttet** | Okt avsluttet. Venter pa trygghetsbekreftelse. |
| **Trygghet bekreftet** | Forsporsleren har bekreftet sikker ankomst. |
| **Avbrutt** | Avbrutt av en av partene. |
| **Utlopt** | Automatisk utlopt (30 minutters timeout). |
