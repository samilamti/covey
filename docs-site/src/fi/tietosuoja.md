---
title: Tietosuoja & GDPR
pageId: privacy
order: 3
layout: layouts/page.njk
description: Miten Covey suojaa yksityisyyttäsi ja noudattaa GDPR:ää.
---

## Tietosuojakäytäntömme

Covey on rakennettu yksityisyys perusperiaatteena. Keräämme mahdollisimman vähän tietoja ja poistamme ne heti, kun niitä ei enää tarvita.

## Tietojen minimointi

### Henkilötunnus (NIN)

Henkilötunnustasi käytetään ainoastaan henkilöllisyytesi vahvistamiseen BankID:n kautta. Sitä **ei koskaan tallenneta selkokielisenä** -- vain kryptografisena tiivisteenä (SHA-256). Tämä tarkoittaa, ettei edes me voi lukea henkilötunnustasi tietokannasta.

### Sijaintitiedot

Sijaintitietoja jaetaan vain aktiivisen session aikana ja ainoastaan sen henkilön kanssa, jonka kanssa koordinoit. Kaikki sijaintitiedot **poistetaan automaattisesti** tietokannasta session päättyessä tietokantatriggerin avulla.

Avoimissa avunpyynnöissä sijaintisi pyöristetään noin 111 metrin tarkkuuteen. Kohteesi ei koskaan näy muille ennen kuin joku on hyväksynyt pyyntösi.

### Pseudonyymit näyttönimet

BankID-nimeäsi ei näytetä muille käyttäjille. Sen sijaan valitset itse näyttönimen. BankID-varmennus pysyy taustalla vastuullisuuden varmistamiseksi.

## Oikeutesi GDPR:n mukaan

### Oikeus tietojen siirrettävyyteen (Artikla 20)

Voit viedä kaikki tietosi kohdasta **Profiili --> Vie tiedot**. Vienti sisältää:
- Profiilisi
- Avunpyyntösi
- Sessioviestit
- Arvioinnit ja arvostelut
- Push-tilaukset

### Oikeus tietojen poistamiseen (Artikla 17)

Voit poistaa tilisi kohdasta **Profiili --> Poista tili**. Prosessi:

1. Tili merkitään poistetuksi (pehmeä poisto).
2. 30 päivän harkinta-aika antaa sinulle mahdollisuuden muuttaa mieltäsi.
3. 30 päivän jälkeen kaikki tiedot poistetaan pysyvästi automaattisella taustaprosessilla.

## Turvallisuusmalli

### Yksityisyys ja turvallisuus

| Uhka | Suojakeino |
|------|-----------|
| Oikeiden nimien tunnistaminen | Pseudonyymit näyttönimet |
| Käyttäjien ristiinviittaus | Profiili näyttää vain näyttönimen ja varmennustilan |
| Pyyntöjen hyväksyminen lähestymiseksi | Varmennuspolku yhdistää BankID-varmennetut henkilöllisyydet jokaiseen sessioon |

### Tekniset suojatoimenpiteet

- **Salaus tiedonsiirron aikana** -- Kaikki liikenne kulkee HTTPS:n (TLS) kautta automaattisesti uusittavilla varmenteilla.
- **Tiivistetyt henkilötunnukset** -- SHA-256, ei koskaan selkokielisenä.
- **Lyhytaikaiset sijaintitiedot** -- Poistetaan automaattisesti session päättyessä.
- **Pyöristetyt koordinaatit** -- Noin 111 metrin tarkkuus avoimissa listoissa.
- **Piilotetut kohteet** -- Ei koskaan näy avoimissa avunpyynnöissä.
- **Nopeusrajoitus** -- Suojaa API:n väärinkäytöltä.

## Ei seurantaa, ei mainoksia

Covey ei käytä seurantaevästeitä, kolmannen osapuolen analytiikkaa eikä mainoksia. Emme koskaan myy tietoja. Alusta rahoitetaan lahjoituksilla ja vapaaehtoistyöllä.

## Yhteystiedot

Jos sinulla on kysyttävää tietojenkäsittelystämme, ota yhteyttä osoitteessa [codeberg.org/Sami-X-Lamti/Tillsammans](https://codeberg.org/Sami-X-Lamti/Tillsammans).
