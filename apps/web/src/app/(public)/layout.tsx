import { SiteHeader } from '@/widgets/site-header';

/**
 * Layout for every visitor-facing page (home, auth, account). It provides the
 * shared public header exactly once; pages render only their own content. The
 * administration area is outside this route group and keeps its own shell.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex min-h-[calc(100dvh-4rem)] flex-col">{children}</main>
    </>
  );
}
