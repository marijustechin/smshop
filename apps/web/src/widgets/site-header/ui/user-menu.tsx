'use client';

import * as React from 'react';
import Link from 'next/link';
import { User } from 'lucide-react';

const MENU_ID = 'user-menu';

/**
 * Moves focus by `delta` through `items`, skipping elements that cannot take
 * focus (for example an item hidden by a responsive utility on the current
 * viewport). Bounded by the number of items so it can never loop forever.
 */
function focusByOffset(items: HTMLElement[], delta: number): void {
  if (items.length === 0) {
    return;
  }
  const current = document.activeElement as HTMLElement | null;
  const currentIndex = current ? items.indexOf(current) : -1;
  for (let step = 1; step <= items.length; step += 1) {
    const index = (((currentIndex + delta * step) % items.length) + items.length) % items.length;
    const candidate = items[index];
    candidate.focus();
    if (document.activeElement === candidate) {
      return;
    }
  }
}

/**
 * Account dropdown for an authenticated visitor. The administration entry is
 * rendered only when `showAdminItem` is set (admin on mobile, where it replaces
 * the direct desktop header action). Keyboard: opens into the menu, Arrow keys
 * cycle the items, Escape closes and restores focus to the trigger; it also
 * closes on outside click and after an item is chosen.
 */
export function UserMenu({
  showAdminItem,
  onLogout,
}: {
  showAdminItem: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const menu = menuRef.current;
    const items = () => Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    focusByOffset(items(), 1);

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusByOffset(items(), 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusByOffset(items(), -1);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const onLogoutClick = () => {
    close();
    onLogout();
  };

  const itemClass =
    'flex min-h-10 w-full items-center px-4 text-left text-sm text-text hover:bg-surface-muted focus-visible:outline-offset-[-2px]';

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Paskyros meniu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-primary transition-colors hover:bg-white/60 focus-visible:outline-focus"
      >
        <User aria-hidden="true" className="h-5 w-5" />
      </button>

      {open ? (
        <div
          id={MENU_ID}
          ref={menuRef}
          role="menu"
          aria-label="Paskyros meniu"
          className="absolute top-full right-0 z-50 mt-2 w-52 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-md"
        >
          {showAdminItem ? (
            <Link href="/administravimas" role="menuitem" onClick={close} className={itemClass}>
              Administravimas
            </Link>
          ) : null}
          <Link href="/paskyra" role="menuitem" onClick={close} className={itemClass}>
            Mano paskyra
          </Link>
          <button type="button" role="menuitem" onClick={onLogoutClick} className={itemClass}>
            Atsijungti
          </button>
        </div>
      ) : null}
    </div>
  );
}
