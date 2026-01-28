# app.js - Dokumentation

## Syfte
Innehåller all logik för applikationen, inklusive vy-hantering, rendering av data och användarinteraktion.

## Arkitektur & Optimering
- **IIFE (Immediately Invoked Function Expression)**: Hela koden är inkapslad i en funktion för att undvika att skräpa ner det globala scopet och för snabbare variabelåtkomst.
- **DOM-Cachning**: Referenser till element som `#login-view`, `#feed-view` etc. lagras i variabler vid start. Detta undviker dyra sökningar i DOM-trädet vid varje klick.
- **Minimal Minnesallokering**: Använder enkla arrayer och sträng-konkatenering för rendering istället för tunga ramverk som skapar tusentals objekt i bakgrunden.
- **Event Delegation**: För filter-knapparna används en gemensam event-lyssnare på förälder-elementet istället för att lägga lyssnare på varje enskild knapp. Detta sparar minne.
- **Inget externt beroende**: Ingen jQuery eller React behövs, vilket minskar nedladdningsstorleken och gör att appen startar omedelbart även på långsamma 3G-nätverk.

## Funktionalitet
1. **Mock-Login**: Simulerar en BankID-verifiering med en fördröjning.
2. **SPA-navigering**: Byter vyer genom att manipulera CSS-klasser (`hidden`).
3. **Realtids-rendering**: Uppdaterar listan över inlägg dynamiskt när användaren postar något nytt.
