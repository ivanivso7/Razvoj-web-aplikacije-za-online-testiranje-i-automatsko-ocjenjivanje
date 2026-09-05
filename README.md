# ZnanjePlus

Web aplikacija za online testiranje i automatsko ocjenjivanje izrađena za završni rad.

## Funkcionalnosti

- korisničko sučelje za učenika i nastavnika
- pitanja višestrukog izbora, kratkog odgovora i programski zadaci
- automatsko bodovanje i detaljan pregled točnih i netočnih odgovora
- katalog testova i pregled rezultata učenika
- nastavnički pregled statistike, testova i učenika
- obrazac za izradu novog testa
- responzivan prikaz za računalo, tablet i mobitel
- D1/SQLite model baze za korisnike, testove, pitanja, pokušaje i odgovore

## Pokretanje

Potrebni su Node.js 22.13 ili noviji i npm.

```bash
npm install
npm run db:local
npm run dev
```

Aplikacija je zatim dostupna na adresi `http://localhost:3000`. Naredbu `npm run db:local` potrebno je izvršiti pri prvom pokretanju i nakon novih migracija baze.

## Korisnički računi

Novi korisnik izrađuje studentski račun putem kartice **Registracija**. Uloga se čuva u bazi i ne može se samostalno mijenjati. Profesor može naknadno dodijeliti drugom korisniku ulogu profesora.

Početni profesorski račun za administraciju projekta je `profesor@znanjeplus.hr` / `Profesor123!`. Njegovi podaci nisu prikazani na prijavnoj stranici.

## Produkcijska provjera

```bash
npm run build
```

Migracija baze nalazi se u mapi `drizzle`, a model tablica u `db/schema.ts`.

## Demonstracija

Registrirajte studentski račun, otvorite **Moji testovi**, pokrenite jedan od tri testa i predajte ga. Sustav odmah računa bodove i sprema pokušaj. Kao profesor moguće je upravljati korisnicima i testovima.
