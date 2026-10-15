# Metis Utdanning Elevhub

Lærerhub for elever, fag, materiell, veiledningstimer og fremdrift.

## Nettside

https://skiloperen05.github.io/metis-utdanning-elevhub/

Endringer på `main` bygges, testes og publiseres automatisk av GitHub Actions.

## Innlogging og data

Appen bruker **Supabase Auth**, databasen **Tutoring Assistant** og en privat Storage-bøtte.
Opprett konto med e-post og et nytt passord på minst 8 tegn. Bekreft e-posten før innlogging.
Du kan også kopiere bekreftelseslenken fra e-posten inn i appens «Har en bekreftelseslenke».

Hver rad er beskyttet av RLS med Supabase-brukerens UUID. Frontendfiltrering gir ingen ekstra rettigheter.
Den offentlige publishable-nøkkelen i `src/lib/publicConfig.ts` er ment for nettleseren; service role og andre hemmelige nøkler skal aldri legges der.

Alle elevkortfelter, notater, oppgavestatus og timeplaner lagres i `data` (JSONB).
Relasjonskolonner knytter oppgaver og materiell til riktige foreldre. Sammensatte fremmednøkler hindrer koblinger mellom ulike brukeres data.
Vedlegg lagres i den private bøtten `material-files`, under brukerens UUID. Maksimal filstørrelse er 20 MiB.

`supabase-schema.sql` oppretter og oppdaterer skjemaet uten å slette eksisterende tabeller.
Den gamle `student_sessions`-tabellen beholdes med klienttilgang sperret.

## Flytt eksisterende data fra AI Studio

1. Åpne den gamle appens «Database og sikkerhetskopi» og last ned JSON-sikkerhetskopi.
2. Opprett og bekreft kontoen på nettsiden med samme e-postadresse.
3. Velg «Database og sikkerhetskopi» → «Importer sikkerhetskopi».
4. Vent på bekreftet overføring. Behold den opprinnelige sikkerhetskopien.

Store filer som bare finnes i gammel IndexedDB må være med i sikkerhetskopien eller legges ved på nytt.
Importvalideringen stopper ved manglende foreldre eller filinnhold. Importen skriver til kontoen som faktisk er innlogget.
Gamle lokale innloggingsdata og Firebase brukes ikke av den publiserte appen.

## Utvikling og kontroll

Krever Node.js 24 og pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm run dev
pnpm run lint
pnpm test
pnpm run build
```

`tests/rls.sql` kontrollerer tilgang med to syntetiske brukere og en anonym klient.
Alle testdata rulles tilbake i samme transaksjon.
