import { SiteHeader } from '@/widgets/site-header';
import { SiteFooter } from '@/widgets/site-footer';

/**
 * Layout for every visitor-facing page (home, catalogue, auth, account). It
 * provides the shared public header and footer exactly once; pages render only
 * their own content. The administration area is outside this route group and
 * keeps its own shell.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
