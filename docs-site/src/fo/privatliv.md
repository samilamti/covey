---
title: Privatlív & GDPR
pageId: privacy
order: 3
layout: layouts/page.njk
description: Hvussu Covey verjar privatlív títt og uppfyllir GDPR.
---

## Privatlívsreglurnar hjá okkum

Covey er byggt við privatlív sum grundprinsipp. Vit savna so lítið av dátum sum gjørligt og strika tað, so skjótt sum tað ikki longur er tørvur á.

## Dátuminnking

### Persónatal (NIN)

Persónagjaldið títt verður bert brúkt til at staðfesta samleika tín gjøgnum BankID. Tað verður **aldrin goymt í klárteksti** -- bert sum kryptografiskt hash (SHA-256). Hetta merkir, at sjálvi vit kunnu ikki lesa persónagjaldið títt úr dátabasanum.

### Staðsetingardáta

Staðsetingardáta verður bert deild undir eini virkini setu og bert við tann persón, tú samskipar við. Øll staðsetingardáta verður **sjálvvirknað strikaður** úr dátabasanum, tá setan endar, við einum dátubasatriggar.

Í opnum bønum verður staðseting tín rundað til umleið 111 metra nágreynileika. Ferðamálið títt verður aldrin víst øðrum, fyrr enn onkur hevur samtykt bønini.

### Dulnevnd vísningarnøvn

BankID-navnið títt verður ikki víst øðrum brúkarum. Tú velur sjálv/ur eitt vísningarnavn. BankID-staðfesting verður verandi í baksýninum fyri ábyrgdarskyld.

## Rættindi tíni samkvæmt GDPR

### Rætturin til dátuflytjanleika (Grein 20)

Tú kanst útflyta øll dátu tíni gjøgnum **Vangamynd → Útflyt dáta**. Útflytingin inniheldur:
- Vangamyndina tína
- Samfelagslimaskap tín
- Hjálparbønirnar tínar
- Setuboð
- Virðingar og ummæli
- Push-áskriftir

### Rætturin til strikingu (Grein 17)

Tú kanst strika kontona tína gjøgnum **Vangamynd → Strika konto**. Gongdin:

1. Kontan verður merkt sum strikað (mjúk striking).
2. Eitt 30 daga betinkingarskeið gevur tær møguleika at umhugsa.
3. Eftir 30 dagar verður øll dáta varanliga strikað av einum sjálvvirkandi bakgrunnsferli.

## Trygdarskipan

### Samfelagstrygd

| Ótti | Vernd |
|------|-------|
| Korta limir | Limalister bert sjónligar hjá limum |
| Korta samfelagsstaðsetingar | Bert økisnøvn víst, aldrin nágreynilig koordinatir |
| Gerast limur til at njósna | Limaskap krevur góðkenning frá umsitara |
| Eyðkenna verulig nøvn | Dulnevnd vísningarnøvn |
| Krosskoyring av brúkarum | Vangamyndin vísir bert vísningarnavn og staðfestingarstøðu |
| Góðtaka bønir til at nálkast mál | Staðfestingarspor knýta BankID-staðfest einkenni til hvørja setu |

### Tøkniligir varnarráðstafnar

- **Dulseting í flutningi** -- Øll umferð gongur gjøgnum HTTPS (TLS) við sjálvvirknandi fornýjaðum váttstøðum.
- **Hashað persónagjøld** -- SHA-256, aldrin í klárteksti.
- **Skammlívað staðsetingardáta** -- Sjálvvirknað strikað, tá setan endar.
- **Rundaðir koordinatir** -- ~111m nágreynileiki í opnum skrásetingum.
- **Loyndir ferðamál** -- Aldrin víst í opnum bønum.
- **Hastigheitsbegring** -- Verjar ímóti misbrúki av API-inum.

## Ongin rakning, ongin lýsing

Covey brúkar ongar rakningarkøkur, ongar greiningarverkty frá triðjapørtum og onga lýsing. Vit selja aldrin dáta. Skipanin verður fjármáluð gjøgnum gávur og sjálvbodið arbeiði.

## Samband

Hevur tú spurningar um dátuhandfaringina hjá okkum, settu teg í samband við okkum á [codeberg.org/Sami-X-Lamti/Tillsammans](https://codeberg.org/Sami-X-Lamti/Tillsammans).
