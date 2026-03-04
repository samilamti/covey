---
title: Prywatność & GDPR
pageId: privacy
order: 3
layout: layouts/page.njk
description: Jak Covey chroni Twoją prywatność i spełnia wymagania GDPR.
---

## Nasza polityka prywatności

Covey jest zbudowane z prywatnością jako podstawową zasadą. Zbieramy jak najmniej danych i usuwamy je, gdy tylko nie są już potrzebne.

## Minimalizacja danych

### Numer identyfikacyjny (NIN)

Twój numer identyfikacyjny jest używany wyłącznie do weryfikacji tożsamości przez BankID. Nigdy **nie jest przechowywany w postaci jawnej** — tylko jako hash kryptograficzny (SHA-256). Oznacza to, że nawet my nie możemy odczytać Twojego numeru identyfikacyjnego z bazy danych.

### Dane lokalizacyjne

Dane lokalizacyjne są udostępniane tylko podczas aktywnej sesji i wyłącznie z osobą, z którą koordynujesz. Wszystkie dane lokalizacyjne są **automatycznie usuwane** z bazy danych po zakończeniu sesji przez wyzwalacz bazodanowy.

W otwartych prośbach Twoja pozycja jest zaokrąglana do około 111 metrów dokładności. Twoja destynacja nigdy nie jest widoczna dla innych, dopóki ktoś nie zaakceptuje Twojej prośby.

### Pseudonimowe nazwy wyświetlane

Twoje imię i nazwisko z BankID nie jest wyświetlane innym użytkownikom. Zamiast tego sam wybierasz nazwę wyświetlaną. Weryfikacja BankID pozostaje w tle w celu zapewnienia odpowiedzialności.

## Twoje prawa zgodnie z GDPR

### Prawo do przenoszenia danych (Artykuł 20)

Możesz wyeksportować wszystkie swoje dane przez **Profil → Eksport danych**. Eksport zawiera:
- Twój profil
- Twoje członkostwa w społecznościach
- Twoje prośby o pomoc
- Wiadomości z sesji
- Oceny i recenzje
- Subskrypcje push

### Prawo do usunięcia (Artykuł 17)

Możesz usunąć swoje konto przez **Profil → Usuń konto**. Proces wygląda następująco:

1. Konto zostaje oznaczone jako usunięte (miękkie usunięcie).
2. 30-dniowy okres na przemyślenie daje Ci możliwość zmiany decyzji.
3. Po 30 dniach wszystkie dane są trwale usuwane przez automatyczny proces w tle.

## Model bezpieczeństwa

### Bezpieczeństwo społeczności

| Zagrożenie | Środek ochronny |
|------------|----------------|
| Mapowanie członków | Listy członków widoczne tylko dla członków |
| Mapowanie lokalizacji społeczności | Wyświetlane są tylko nazwy obszarów, nigdy dokładne współrzędne |
| Dołączanie w celu inwigilacji | Członkostwo wymaga zatwierdzenia przez administratora |
| Identyfikacja prawdziwych imion | Pseudonimowe nazwy wyświetlane |
| Krzyżowe referencje użytkowników | Profil pokazuje tylko nazwę wyświetlaną i status weryfikacji |
| Akceptowanie próśb w celu zbliżenia się do celu | Ślad weryfikacji wiąże tożsamości zweryfikowane przez BankID z każdą sesją |

### Zabezpieczenia techniczne

- **Szyfrowanie w tranzycie** — Cały ruch przechodzi przez HTTPS (TLS) z automatycznie odnawianymi certyfikatami.
- **Hashowane numery identyfikacyjne** — SHA-256, nigdy w postaci jawnej.
- **Efemeryczne dane lokalizacyjne** — Automatycznie usuwane po zakończeniu sesji.
- **Zaokrąglone współrzędne** — Około 111 m dokładności w otwartych listach.
- **Ukryte destynacje** — Nigdy nie są wyświetlane w otwartych prośbach.
- **Ograniczenie częstotliwości** — Ochrona przed nadużywaniem API.

## Brak śledzenia, brak reklam

Covey nie używa plików cookie śledzących, analityki firm trzecich ani reklam. Nigdy nie sprzedajemy danych. Platforma jest finansowana z darowizn i pracy wolontariuszy.

## Kontakt

Jeśli masz pytania dotyczące przetwarzania danych, skontaktuj się z nami przez [codeberg.org/Sami-X-Lamti/Tillsammans](https://codeberg.org/Sami-X-Lamti/Tillsammans).
