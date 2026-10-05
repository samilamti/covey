# Covey 🇸🇪

**Slipp gå hem ensam.** Covey är en digital trygghetstjänst som gör det möjligt att snabbt
och tryggt koordinera vardaglig säkerhet — som att gå hem tillsammans på kvällen — mellan
personer i geografisk närhet, verifierade med BankID.

Covey är **inte** en dejtingtjänst, inte ett socialt nätverk och inte en ersättning för
polis eller larmtjänster. Det finns inget flöde, inga följare och ingen möjlighet att söka
efter personer — bara efter förfrågningar om hjälp. Samordningen upphör när promenaden gör det.

Tjänsten drivs av **Covey AB**, ett svenskt aktiebolag utan vinstutdelning: överskott
återinvesteras i verksamheten. Ingen reklam, ingen datahandel, inga sponsrade matchningar.

- **Live:** [covey.se](https://covey.se) · **Dokumentation:** [docs.covey.se](https://docs.covey.se)
- **Källkod:** [github.com/samilamti/covey](https://github.com/samilamti/covey)
  (projektet hette tidigare *Tillsammans*)

## Så fungerar det

1. Logga in med BankID.
2. Skapa en förfrågan — *gå med mig* eller *vänta med mig* — med upphämtnings- och målpunkt.
3. Välj vem som får se den. Standard är den mest restriktiva nivån: samma kön, födelseår ±5 år.
4. Förfrågan går ut i realtid till behöriga i närheten.
5. Någon accepterar → en aktiv session med karta, beräknad ankomsttid och meddelanden i sessionen.
6. Båda bekräftar att sällskapet är avslutat, och den som bad om hjälp bekräftar att hen kommit fram tryggt.

## Integritet i arkitekturen, inte bara i policyn

- **Personnummer lagras aldrig i klartext** — endast som SHA-256-hash. Kön och födelseår
  härleds vid inloggning och lagras separat.
- **Visningsnamn är pseudonymer** som användaren själv väljer.
- **Öppna förfrågningar avrundar koordinater** till ~111 m, och målpunkten visas inte
  förrän någon har accepterat.
- **Positionsdata är efemär** — en databastrigger raderar den när sessionen avslutas.
- **GDPR:** export via `GET /api/gdpr/export`, radering med 30 dagars ångerperiod.

## Teknik

Preact + Vite frontend · Node/Express + Socket.io + PostgreSQL 16 backend · Capacitor för
iOS och Android · Eleventy för dokumentationssajten · Docker Compose bakom Traefik med
Let's Encrypt · 12 språk med svenska som källspråk.

## Utveckling

```bash
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

```bash
cd backend && npm test && cd ../frontend && npm test
```

Se `docs/` för arkitektur, driftsättning och färdplan — `docs/architecture.md` är rätt
startpunkt. Bidrag är välkomna; `docs-site/` innehåller riktlinjer och uppförandekod.
