---
title: Ordlista
pageId: glossary
order: 5
layout: layouts/page.njk
description: Förklaring av viktiga begrepp som används i Covey.
---

## Grundbegrepp

### Hjälpförfrågan

En tidsbegränsad förfrågan om säkerhetsstöd i verkligheten — till exempel "Jag behöver någon att gå hem med." Skapas av en **begärare** och utförs av en **hjälpare**. Kan vara **fristående** (utan community) eller **community-knuten**.

### Begärare

Den som skapar en hjälpförfrågan. Personen söker trygghetsstöd, till exempel en gångkompanjon.

### Hjälpare

Den som accepterar och utför en hjälpförfrågan. Måste uppfylla behörighetskrav innan godkännande. Under en aktiv session delar båda parter sin position i realtid.

### Session

Den aktiva fasen av en hjälpförfrågan, från godkännande till avslut. Under en session kan begärare och hjälpare utbyta meddelanden och dela position.

### Community

En grupp användare med en gemensam kontext, till exempel ett bostadsområde, en arbetsplats eller ett universitet. Communities använder godkända medlemskap och pseudonyma visningsnamn.

### Fristående förfrågan

En hjälpförfrågan skapad utan community. Synlig för alla verifierade användare.

## Behörighet och trygghet

### Behörighetsnivå

Styr vem som kan se och acceptera en förfrågan. Tre nivåer finns:

| Nivå | Regel | Beskrivning |
|------|-------|-------------|
| **Liknande som jag** | Samma kön OCH födelseår ±5 | Standard. Matchar personer av liknande ålder och kön. |
| **Verifierade väktare** | Demografisk matchning ELLER trygghetspoäng ≥ 5 | Öppnar för erfarna hjälpare. |
| **Alla medlemmar** | Inga begränsningar | Alla verifierade användare kan acceptera. |

### Trygghetspoäng

Ett ackumulerat poäng baserat på omdömen efter avslutade sessioner. Nya användare börjar på 0. En poäng på 5 eller högre kvalificerar som **verifierad väktare**.

### Verifierad väktare

En användare vars trygghetspoäng uppnår tröskelvärdet (för närvarande 5). Kan acceptera förfrågningar på nivån "Verifierade väktare" även utan demografisk matchning.

## Identitet och autentisering

### BankID

Sveriges nationella elektroniska identifieringssystem. Används för säker inloggning i Covey.

### Personnummer (NIN)

Svenskt personnummer i formatet ÅÅÅÅMMDDXXXX. Används för BankID-verifiering. Lagras **aldrig i klartext** — bara som kryptografisk hash.

## Plats och geografi

### Realtidspositionsdelning

Delning av position mellan begärare och hjälpare under en aktiv session. Hastighetsbegränsad till en uppdatering var femte sekund. All platsdata raderas när sessionen avslutas.

### Beräknad ankomsttid (ETA)

Beräkning av ungefärlig tid till möte baserad på fågelvägsavstånd med antagen gånghastighet (5 km/h).

## Förfrågningens livscykel

En hjälpförfrågan går genom följande statusar:

| Status | Betydelse |
|--------|-----------|
| **Öppen** | Väntar på hjälpare. Synlig i listor baserat på behörighet. |
| **Accepterad** | Hjälpare tilldelad. Meddelanden aktiverade. |
| **Aktiv** | Session pågår. Positionsdelning aktiv. |
| **Avslutas** | Endera part har markerat klar, väntar på bekräftelse. |
| **Avslutad** | Session avslutad. Väntar på trygghetsbekräftelse. |
| **Trygghet bekräftad** | Begäraren har bekräftat säker ankomst. |
| **Avbruten** | Avbruten av endera part. |
| **Utgången** | Automatiskt utgången (30 minuters timeout). |
