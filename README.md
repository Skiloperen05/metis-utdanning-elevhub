# Metis Utdanning Elevhub

En moderne og intuitiv lærer- og administrasjonshub utviklet for Metis Utdanning. Appen gir lærere og veiledere full oversikt over elever, fagbank, øktplanlegging, eksamensforberedelser og fremdriftsmatriser.

---

## 🚀 Hovedfunksjoner

- **Elevoversikt & Elevkort**: Detaljert oversikt over elever, kontaktinformasjon, fagtilknytning, notater og fremdrift.
- **Fag- & Materialbank**: Organisering av læremateriell, oppgaver, eksamenssett og ressursfiler etter fag og trinn.
- **Øktplanlegger**: Planlegg veiledningstimer og sesjoner med mål, agenda og automatisk PDF-generering.
- **Fremdriftsmatrise**: Visuell oversikt over elevens måloppnåelse og status i pensum.
- **Rapport- & PDF-eksport**: Generer profesjonelle oppsummeringer og elevrapporter med ett klikk.
- **Supabase PostgreSQL & Firebase**: Støtte for sanntidssynkronisering mot Supabase og Google Cloud Firestore.

---

## 🛠️ Teknologistakk

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide React (ikoner)
- **Database & Auth**: Supabase (PostgreSQL) / Google Cloud Firestore
- **PDF-generering**: jsPDF / PDFMake
- **Byggeverktøy**: Vite

---

## ⚡ Supabase Oppsett

1. Opprett et gratis prosjekt på [supabase.com](https://supabase.com).
2. Gå til **SQL Editor** ➜ **New query**, åpne filen `supabase-schema.sql` fra dette prosjektet, lim inn og klikk **Run**.
3. Hent prosjektets **URL** og **Anon API Key** fra **Project Settings ➜ API**.
4. I appen kan du enten:
   - Åpne **Database & Sikkerhetskopi** i toppmenyen og lime inn nøklene der (lagres automatisk), ELLER
   - Legge dem til i `.env`:
     ```bash
     VITE_SUPABASE_URL="https://ditt-prosjekt.supabase.co"
     VITE_SUPABASE_ANON_KEY="din-anon-nøkkel"
     ```

---

## 💻 Komme i gang lokalt

### 1. Klon repositoriet
```bash
git clone https://github.com/Skiloperen05/metis-utdanning-elevhub.git
cd metis-utdanning-elevhub
```

### 2. Installer avhengigheter
```bash
npm install
```

### 3. Start utviklingsserveren
```bash
npm run dev
```
Appen åpnes på `http://localhost:3000` (eller oppgitt Vite-port).

### 4. Bygg for produksjon
```bash
npm run build
```

---

## 🌐 Gratis publisering på nett (Vercel)

1. Gå til [Vercel.com](https://vercel.com) og logg inn med din GitHub-bruker.
2. Velg **Add New... ➜ Project** og importer `Skiloperen05/metis-utdanning-elevhub`.
3. (Valgfritt) Legg til `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY` under Environment Variables.
4. Klikk **Deploy**. Nettsiden din er nå tilgjengelig over hele verden med automatisk SSL!

---

## 📄 Lisens
Utviklet for Metis Utdanning.
