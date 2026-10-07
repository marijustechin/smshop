import * as React from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * Responsive page container: consistent max width and gutters. `width="wide"`
 * is a deliberate opt-in used by the catalogue listing (1280 px); it never
 * changes the default global container rule.
 */
export function Container({
  className,
  width = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { width?: 'default' | 'wide' }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 lg:px-8',
        width === 'wide' ? 'max-w-7xl' : 'max-w-6xl',
        className,
      )}
      {...props}
    />
  );
}

/** Vertical section wrapper with the shared responsive rhythm. */
export function Section({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn('py-10 sm:py-14', className)} {...props} />;
}
