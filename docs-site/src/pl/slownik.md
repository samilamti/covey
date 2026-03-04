---
title: Słownik
pageId: glossary
order: 5
layout: layouts/page.njk
description: Objaśnienie ważnych pojęć używanych w Covey.
---

## Podstawowe pojęcia

### Prośba o pomoc

Ograniczona czasowo prośba o wsparcie bezpieczeństwa w rzeczywistości — na przykład "Potrzebuję kogoś, kto pójdzie ze mną do domu." Tworzona przez **wnioskodawcę** i realizowana przez **pomocnika**.

### Wnioskodawca

Osoba, która tworzy prośbę o pomoc. Szuka wsparcia bezpieczeństwa, na przykład towarzysza na drodze do domu.

### Pomocnik

Osoba, która akceptuje i realizuje prośbę o pomoc. Musi spełniać wymagania kwalifikacyjne przed zatwierdzeniem. Podczas aktywnej sesji obie strony udostępniają swoją pozycję w czasie rzeczywistym.

### Sesja

Aktywna faza prośby o pomoc, od zatwierdzenia do zakończenia. Podczas sesji wnioskodawca i pomocnik mogą wymieniać wiadomości i udostępniać swoją pozycję.

## Kwalifikacja i bezpieczeństwo

### Poziom kwalifikacji

Określa, kto może zobaczyć i zaakceptować prośbę. Dostępne są trzy poziomy:

| Poziom | Zasada | Opis |
|--------|--------|------|
| **Podobni do mnie** | Ta sama płeć ORAZ rok urodzenia ±5 | Domyślny. Dopasowuje osoby o podobnym wieku i płci. |
| **Kwalifikowani towarzysze** | Dopasowanie demograficzne LUB ocena bezpieczeństwa ≥ 5 | Otwiera dla doświadczonych pomocników. |
| **Wszyscy członkowie** | Brak ograniczeń | Wszyscy zweryfikowani użytkownicy mogą zaakceptować. |

### Ocena bezpieczeństwa

Skumulowana ocena oparta na recenzjach po zakończonych sesjach. Nowi użytkownicy zaczynają od 0. Ocena 5 lub wyższa kwalifikuje jako **kwalifikowany towarzysz**.

### Kwalifikowany towarzysz

Użytkownik, którego ocena bezpieczeństwa osiąga wartość progową (obecnie 5). Może akceptować prośby na poziomie "Kwalifikowani towarzysze" nawet bez dopasowania demograficznego.

## Tożsamość i uwierzytelnianie

### BankID

Szwedzki krajowy system elektronicznej identyfikacji. Używany do bezpiecznego logowania w Covey.

### Numer identyfikacyjny (NIN)

Szwedzki numer identyfikacyjny w formacie RRRRMMDDXXXX. Używany do weryfikacji BankID. Nigdy **nie jest przechowywany w postaci jawnej** — tylko jako hash kryptograficzny.

## Lokalizacja i geografia

### Przekazywanie pozycji w czasie rzeczywistym

Udostępnianie pozycji między wnioskodawcą a pomocnikiem podczas aktywnej sesji. Ograniczone do jednej aktualizacji co pięć sekund. Wszystkie dane lokalizacyjne są usuwane po zakończeniu sesji.

### Szacowany czas przybycia (ETA)

Obliczenie przybliżonego czasu do spotkania na podstawie odległości w linii prostej przy założonej prędkości chodu (5 km/h).

## Cykl życia prośby

Prośba o pomoc przechodzi przez następujące statusy:

| Status | Znaczenie |
|--------|-----------|
| **Otwarta** | Oczekuje na pomocnika. Widoczna na listach na podstawie kwalifikacji. |
| **Zaakceptowana** | Pomocnik przydzielony. Wiadomości aktywowane. |
| **Aktywna** | Sesja w toku. Udostępnianie pozycji aktywne. |
| **Kończenie** | Jedna ze stron oznaczyła jako zakończone, oczekiwanie na potwierdzenie. |
| **Zakończona** | Sesja zakończona. Oczekiwanie na potwierdzenie bezpieczeństwa. |
| **Bezpieczeństwo potwierdzone** | Wnioskodawca potwierdził bezpieczne dotarcie. |
| **Anulowana** | Anulowana przez jedną ze stron. |
| **Wygasła** | Automatycznie wygasła (30 minut timeout). |
