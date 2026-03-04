---
title: Ordliste
pageId: glossary
order: 5
layout: layouts/page.njk
description: Forklaring af vigtige begreber, der bruges i Covey.
---

## Grundlaeggende begreber

### Hjaelpeanmodning

En tidsbegreanset anmodning om sikkerhedsstotte i virkeligheden -- for eksempel "Jeg har brug for nogen at ga hjem med." Oprettes af en **anmoder** og udfores af en **hjaelper**. Kan vaere **fristaende** (uden faellesskab) eller **faellesskabstilknyttet**.

### Anmoder

Den der opretter en hjaelpeanmodning. Personen soger tryghedsstotte, for eksempel en gangfolge.

### Hjaelper

Den der accepterer og udforer en hjaelpeanmodning. Skal opfylde kvalifikationskrav for godkendelse. Under en aktiv session deler begge parter deres position i realtid.

### Session

Den aktive fase af en hjaelpeanmodning, fra godkendelse til afslutning. Under en session kan anmoder og hjaelper udveksle beskeder og dele position.

### Faellesskab

En gruppe brugere med en faelles kontekst, for eksempel et boligomrade, en arbejdsplads eller et universitet. Faellesskaber bruger godkendte medlemskaber og pseudonyme visningsnavne.

### Fristaende anmodning

En hjaelpeanmodning oprettet uden faellesskab. Synlig for alle verificerede brugere.

## Kvalifikation og tryghed

### Kvalifikationsniveau

Styrer hvem der kan se og acceptere en anmodning. Tre niveauer findes:

| Niveau | Regel | Beskrivelse |
|--------|-------|-------------|
| **Lignende som mig** | Samme kon OG fodselsar +-5 | Standard. Matcher personer af lignende alder og kon. |
| **Verificerede vogtere** | Demografisk matching ELLER tryghedscore >= 5 | Abner for erfarne hjaelpere. |
| **Alle medlemmer** | Ingen begraensninger | Alle verificerede brugere kan acceptere. |

### Tryghedscore

En akkumuleret score baseret pa vurderinger efter afsluttede sessioner. Nye brugere starter pa 0. En score pa 5 eller hojere kvalificerer som **verificeret vogter**.

### Verificeret vogter

En bruger, hvis tryghedscore nar taerskelvaerdien (i ojeblikket 5). Kan acceptere anmodninger pa niveauet "Verificerede vogtere" selv uden demografisk matching.

## Identitet og autentificering

### BankID

Sveriges nationale elektroniske identifikationssystem. Bruges til sikker login i Covey.

### Personnummer (NIN)

Svensk personnummer i formatet YYYYMMDDXXXX. Bruges til BankID-verificering. Lagres **aldrig i klartekst** -- kun som kryptografisk hash.

## Position og geografi

### Realtidspositionsdeling

Deling af position mellem anmoder og hjaelper under en aktiv session. Hastighedsbegreanset til en opdatering hvert femte sekund. Alle positionsdata slettes, nar sessionen afsluttes.

### Beregnet ankomsttid (ETA)

Beregning af omtrentlig tid til mode baseret pa luftlinjeafstand med antaget gangtempo (5 km/t).

## Anmodningens livscyklus

En hjaelpeanmodning gar gennem folgende statusser:

| Status | Betydning |
|--------|-----------|
| **Aben** | Venter pa hjaelper. Synlig i lister baseret pa kvalifikation. |
| **Accepteret** | Hjaelper tildelt. Beskeder aktiveret. |
| **Aktiv** | Session i gang. Positionsdeling aktiv. |
| **Afsluttes** | En part har markeret faerdig, venter pa bekraeftelse. |
| **Afsluttet** | Session afsluttet. Venter pa tryghedsbekraeftelse. |
| **Tryghed bekraeftet** | Anmoderen har bekraeftet sikker ankomst. |
| **Annulleret** | Annulleret af en af parterne. |
| **Udlobet** | Automatisk udlobet (30 minutters timeout). |
