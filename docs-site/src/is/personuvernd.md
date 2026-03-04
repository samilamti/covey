---
title: Persónuvernd & GDPR
pageId: privacy
order: 3
layout: layouts/page.njk
description: Hvernig Covey verndar persónuvernd þína og uppfyllir GDPR.
---

## Persónuverndarstefna okkar

Covey er byggt á persónuvernd sem grundvallarreglu. Við söfnum eins litlum gögnum og mögulegt er og eyðum þeim um leið og þeirra er ekki lengur þörf.

## Lágmörkun gagna

### Kennitala (NIN)

Kennitalan þín er einungis notuð til að staðfesta auðkenni þitt í gegnum BankID. Hún er **aldrei geymd sem hreinn texti** -- aðeins sem dulmálshash (SHA-256). Þetta þýðir að ekki einu sinni við getum lesið kennitöluna þína úr gagnagrunninum.

### Staðsetningargögn

Staðsetningargögnum er aðeins deilt á virkum fundi og einungis með þeim sem þú ert að samhæfa við. Öllum staðsetningargögnum er **sjálfkrafa eytt** úr gagnagrunninum þegar fundinum lýkur með gagnagrunnstriger.

Í opnum beiðnum er staðsetning þín námunduð í um það bil 111 metra nákvæmni. Áfangastaður þinn sést aldrei af öðrum fyrr en einhver hefur samþykkt beiðni þína.

### Dulnefni sem birtingarnöfn

BankID-nafnið þitt sést ekki af öðrum notendum. Þess í stað velur þú sjálf/ur birtingarnafn. BankID-staðfestingin er áfram til staðar í bakgrunninum til ábyrgðarskyni.

## Réttindi þín samkvæmt GDPR

### Réttur til gagnaflutnings (Grein 20)

Þú getur flutt út öll gögnin þín í **Prófíl --> Flytja út gögn**. Útflutningurinn inniheldur:
- Prófílinn þinn
- Samfélagsaðild þína
- Aðstoðarbeiðnir þínar
- Fundaskilaboð
- Einkunnir og umsagnir
- Push-áskriftir

### Réttur til eyðingar (Grein 17)

Þú getur eytt reikningnum þínum í **Prófíl --> Eyða reikningi**. Ferlið:

1. Reikningurinn er merktur sem eyddur (mjúk eyðing).
2. 30 daga betankitími gefur þér tækifæri til að skipta um skoðun.
3. Eftir 30 daga er öllum gögnum eytt varanlega af sjálfvirkum bakgrunnsferli.

## Öryggislíkan

### Samfélagsöryggi

| Ógn | Varnaraðgerð |
|-----|-------------|
| Kortleggja meðlimi | Meðlimalistar sýnilegar aðeins meðlimum |
| Kortleggja staðsetningar samfélaga | Aðeins svæðisnöfn sýnd, aldrei nákvæmar hnit |
| Ganga í til eftirlits | Aðild krefst samþykkis stjórnanda |
| Greina raunveruleg nöfn | Dulnefni sem birtingarnöfn |
| Krosstenging notenda | Prófíllinn sýnir aðeins birtingarnafn og staðfestingarstöðu |
| Samþykkja beiðnir til að nálgast markmið | Staðfestingarslóð tengir BankID-staðfest auðkenni við hvern fund |

### Tæknilegar varnaraðgerðir

- **Dulkóðun í flutningi** -- Öll umferð fer í gegnum HTTPS (TLS) með sjálfkrafa endurnýjuðum skilríkjum.
- **Hashaðar kennitölur** -- SHA-256, aldrei sem hreinn texti.
- **Skammvinn staðsetningargögn** -- Þeim er sjálfkrafa eytt við lok fundar.
- **Námundaðar hnit** -- Um 111m nákvæmni í opnum listum.
- **Faldir áfangastaðir** -- Sjást aldrei í opnum beiðnum.
- **Hraðatakmörkun** -- Verndar gegn misnotkun API.

## Engin rakning, engar auglýsingar

Covey notar engin rakningarkökur, engar greiningar frá þriðja aðila og engar auglýsingar. Við seljum aldrei gögn. Vettvangurinn er fjármagnaður með framlögum og sjálfboðavinnu.

## Hafa samband

Ef þú hefur spurningar um gagnavinnslu okkar, hafðu samband á [codeberg.org/Sami-X-Lamti/Tillsammans](https://codeberg.org/Sami-X-Lamti/Tillsammans).
