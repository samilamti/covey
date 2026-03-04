---
title: Sanasto
pageId: glossary
order: 5
layout: layouts/page.njk
description: Coveyssa käytettyjen tärkeiden käsitteiden selitykset.
---

## Peruskäsitteet

### Avunpyyntö

Aikarajoitettu pyyntö turvallisuustuesta todellisuudessa -- esimerkiksi "Tarvitsen jonkun kävelemään kanssani kotiin." Sen luo **pyytäjä** ja sen toteuttaa **auttaja**. Voi olla **itsenäinen** (ilman yhteisöä) tai **yhteisöön sidottu**.

### Pyytäjä

Henkilö, joka luo avunpyynnön. Hän etsii turvallisuustukea, esimerkiksi kävelykumppania.

### Auttaja

Henkilö, joka hyväksyy ja toteuttaa avunpyynnön. Hänen on täytettävä kelpoisuusvaatimukset ennen hyväksymistä. Aktiivisen session aikana molemmat osapuolet jakavat sijaintinsa reaaliaikaisesti.

### Sessio

Avunpyynnön aktiivinen vaihe hyväksynnästä päättymiseen. Session aikana pyytäjä ja auttaja voivat vaihtaa viestejä ja jakaa sijaintiaan.

### Yhteisö

Käyttäjäryhmä, jolla on yhteinen konteksti, esimerkiksi asuinalue, työpaikka tai yliopisto. Yhteisöt käyttävät hyväksyttyjä jäsenyyksiä ja pseudonyymejä näyttönimiä.

### Itsenäinen pyyntö

Avunpyyntö, joka on luotu ilman yhteisöä. Näkyy kaikille varmennetuille käyttäjille.

## Kelpoisuus ja turvallisuus

### Kelpoisuustaso

Ohjaa sitä, kuka voi nähdä ja hyväksyä pyynnön. Kolme tasoa on olemassa:

| Taso | Sääntö | Kuvaus |
|------|--------|--------|
| **Samankaltaiset kuin minä** | Sama sukupuoli JA syntymävuosi ±5 | Oletus. Yhdistää samanikäiset ja samaa sukupuolta olevat. |
| **Varmennetut vartijat** | Demografinen vastaavuus TAI turvallisuuspistemäärä >=5 | Avaa mahdollisuuden kokeneille auttajille. |
| **Kaikki jäsenet** | Ei rajoituksia | Kaikki varmennetut käyttäjät voivat hyväksyä. |

### Turvallisuuspistemäärä

Kertynyt pistemäärä, joka perustuu arviointeihin päättyneiden sessioiden jälkeen. Uudet käyttäjät aloittavat nollasta. Pistemäärä 5 tai korkeampi oikeuttaa **varmennetun vartijan** asemaan.

### Varmennettu vartija

Käyttäjä, jonka turvallisuuspistemäärä saavuttaa kynnysarvon (tällä hetkellä 5). Voi hyväksyä pyyntöjä "Varmennetut vartijat" -tasolla ilman demografista vastaavuutta.

## Henkilöllisyys ja tunnistautuminen

### BankID

Ruotsin kansallinen sähköinen tunnistautumisjärjestelmä. Sitä käytetään turvalliseen kirjautumiseen Coveyssa.

### Henkilötunnus (NIN)

Ruotsalainen henkilötunnus muodossa VVVVKKPPXXXX. Sitä käytetään BankID-varmennukseen. Sitä **ei koskaan tallenneta selkokielisenä** -- vain kryptografisena tiivisteenä.

## Sijainti ja maantiede

### Reaaliaikainen sijainnin jakaminen

Sijainnin jakaminen pyytäjän ja auttajan välillä aktiivisen session aikana. Nopeusrajoitettu yhteen päivitykseen viiden sekunnin välein. Kaikki sijaintitiedot poistetaan session päättyessä.

### Arvioitu saapumisaika (ETA)

Laskelma arvioidusta kohtaamisajasta, joka perustuu linnuntie-etäisyyteen oletetulla kävelyvauhdilla (5 km/h).

## Avunpyynnön elinkaari

Avunpyyntö käy läpi seuraavat tilat:

| Tila | Merkitys |
|------|----------|
| **Avoin** | Odottaa auttajaa. Näkyy listoissa kelpoisuuden perusteella. |
| **Hyväksytty** | Auttaja määrätty. Viestit käytössä. |
| **Aktiivinen** | Sessio käynnissä. Sijainnin jakaminen aktiivinen. |
| **Päättymässä** | Toinen osapuoli on merkinnyt valmiiksi, odottaa vahvistusta. |
| **Päättynyt** | Sessio päättynyt. Odottaa turvallisuusvahvistusta. |
| **Turvallisuus vahvistettu** | Pyytäjä on vahvistanut turvallisen saapumisen. |
| **Peruutettu** | Peruutettu jommankumman osapuolen toimesta. |
| **Vanhentunut** | Vanhentunut automaattisesti (30 minuutin aikakatkaisu). |
