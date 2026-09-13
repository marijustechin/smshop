import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold text-chocolate">Šokolado meistrai</h1>
      <p className="text-muted">Parduotuvė netrukus. Kol kas — paskyros funkcijos.</p>
      <nav className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link
          href="/prisijungti"
          className="rounded-md bg-chocolate px-4 py-2 font-medium text-ivory hover:bg-[#3f2114]"
        >
          Prisijungti
        </Link>
        <Link
          href="/registracija"
          className="rounded-md border border-border bg-white px-4 py-2 font-medium text-ink hover:bg-cream/40"
        >
          Registruotis
        </Link>
        <Link
          href="/paskyra"
          className="rounded-md px-4 py-2 font-medium text-chocolate hover:bg-cream/50"
        >
          Paskyra
        </Link>
      </nav>
    </main>
  );
}
