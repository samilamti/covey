# style.css - Dokumentation

## Syfte
Ansvarar för applikationens visuella lager med fokus på prestanda och en "native" känsla på mobila enheter.

## Designval
- **Flexbox**: Används för layout eftersom det stöds brett av både äldre och nyare webbläsare.
- **Systemtypsnitt**: Genom att använda `-apple-system`, `BlinkMacSystemFont` etc. sparar vi in på nätverksanrop för att ladda externa typsnitt (som Google Fonts).
- **GPU-accelerering**: Använder `transform` för interaktionseffekter (t.ex. `.card:active`) vilket renderas mer effektivt av mobilens grafikprocessor.
- **-webkit-tap-highlight-color**: Borttaget för att förhindra den gråa rutan som annars visas när man klickar på element i iOS/Android-webbläsare.

## Prestandaoptimeringar
- Minimalt antal selektorer för snabbare beräkning av stilar.
- Inga tunga filter eller avancerade skuggor som kan lagga på äldre hårdvara.
- Responsiv design via `viewport`-enheter (% och vh/vw) iställer för enbart fasta pixlar.
