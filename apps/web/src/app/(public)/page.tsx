import Link from 'next/link';
import { Container } from '@/shared/ui/container';
import { buttonVariants } from '@/shared/ui/button';

export default function Home() {
  return (
    <Container className="flex flex-1 items-center py-16 sm:py-24">
      <div className="mx-auto w-full max-w-2xl text-center">
        <p className="text-sm font-medium tracking-[0.2em] text-accent uppercase">
          Rankų darbo šokoladas
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
          Šokolado meistrai
        </h1>
        <p className="mt-4 text-text-muted">
          Premium šokoladas ir konditerija. Parduotuvė netrukus — kol kas galite susikurti paskyrą
          ir prisijungti.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/registracija" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            Registruotis
          </Link>
          <Link href="/prisijungti" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Prisijungti
          </Link>
        </div>
      </div>
    </Container>
  );
}
