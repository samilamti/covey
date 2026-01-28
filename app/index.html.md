# index.html - Dokumentation

## Syfte
Denna fil utgör applikationens grundstruktur. Den är utformad som en **Single Page Application (SPA)** för att minimera laddningstider och nätverkstrafik, vilket är avgörande för äldre mobila enheter.

## Struktur
- **#app**: Huvudcontainern som begränsar renderingen.
- **Vyer (Views)**: Sektioner med klassen `.view` som döljs och visas av JavaScript istället för att ladda nya sidor.
- **ID-namngivning**: Korta och unika ID:n används för snabb DOM-åtkomst i JavaScript.
- **Viewport**: Inställd för att förhindra oavsiktlig zoomning på mobila enheter, vilket ger en mer "native" känsla.

## Prestandaoptimeringar
- Inga externa typsnitt (använder systemtypsnitt).
- Minimal användning av tunga HTML-element.
- Placerad script-tag i botten för att inte blockera rendering.
