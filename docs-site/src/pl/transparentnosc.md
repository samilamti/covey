---
title: Przejrzystość techniczna
pageId: transparency
order: 6
layout: layouts/page.njk
description: Przegląd architektury technicznej i decyzji projektowych Covey.
---

## Otwarty kod źródłowy

Cały kod źródłowy Covey jest publicznie dostępny na [Codeberg](https://codeberg.org/Sami-X-Lamti/Tillsammans). Każdy może go przejrzeć, wnieść wkład i rozwijać dalej.

## Przegląd architektury

Covey składa się z czterech usług współpracujących przez Docker Compose:

| Usługa | Rola |
|--------|------|
| **Frontend** | Interfejs webowy zbudowany z Preact, serwowany przez nginx |
| **Backend** | API i komunikacja w czasie rzeczywistym z Express i Socket.io |
| **Baza danych** | PostgreSQL 16 do przechowywania danych |
| **Traefik** | Reverse proxy z automatycznym zarządzaniem certyfikatami TLS |

## Zasady projektowe

### Preact zamiast React

Używamy Preact (3 KB) zamiast React (40 KB), aby aplikacja ładowała się szybko nawet na starszych urządzeniach i wolnych połączeniach. API jest prawie identyczne.

### Progressive Web App (PWA)

Covey jest dystrybuowane jako PWA — nie potrzeba sklepu z aplikacjami. Zainstaluj bezpośrednio z przeglądarki, działa offline dla podstawowych funkcji i otrzymuje powiadomienia push jak zwykła aplikacja.

### Proste flagi funkcji

Funkcje są aktywowane przez zmienne środowiskowe, a nie skomplikowane systemy. Proste, niezawodne i bez zewnętrznych zależności.

### Polling jako priorytet dla kompatybilności

Socket.io jest skonfigurowane tak, aby zaczynać od HTTP polling i następnie aktualizować do WebSocket. Gwarantuje to, że starsze przeglądarki mogą się połączyć bezpośrednio.

### Renderowanie map z OpenStreetMap

Używamy Leaflet z OpenStreetMap — całkowicie za darmo, bez klucza API i z otwartym kodem źródłowym.

### Wątki wewnątrzprocesowe

Zadania w tle (wygasanie próśb, usuwanie GDPR) działają jako zaplanowane procesy w tym samym procesie Node — nie potrzeba zewnętrznej kolejki zadań.

## Przepływ danych

1. **Treści statyczne**: Przeglądarka → Traefik → nginx → HTML/JS/CSS
2. **Wywołania API**: Przeglądarka → Traefik → Express → PostgreSQL
3. **Czas rzeczywisty**: Przeglądarka → Traefik → Socket.io (aktualizacja z polling do WebSocket)

## CI/CD

Repozytorium kodu jest hostowane na Codeberg z Woodpecker CI do automatycznych testów i budowania. Każde wypchnięcie uruchamia testy backendu i frontendu oraz weryfikuje, czy kompilacja produkcyjna działa poprawnie.

## Decyzje bezpieczeństwa

- **JWT z HS256** — Bezstanowe uwierzytelnianie z 24-godzinnym czasem wygaśnięcia.
- **Członkostwo zatwierdzane przez administratora** — Członkostwo w społeczności wymaga ręcznego zatwierdzenia.
- **Pseudonimowe nazwy** — Nazwy z BankID nigdy nie są automatycznie wyświetlane.
- **Nazwy obszarów zamiast współrzędnych** — Społeczności wyświetlają "Södermalm", a nie dokładne współrzędne GPS.
- **Haversine zamiast PostGIS** — Prostsze, lżejsze i wystarczające w skali miejskiej.
- **Ograniczanie częstotliwości w pamięci** — Nie potrzeba Redis dla wdrożenia na jednym serwerze.

## Hosting

Covey jest hostowane na VPS u GleSYS w Sztokholmie, zasilanym energią odnawialną. Certyfikaty TLS są zarządzane automatycznie przez Let's Encrypt.
