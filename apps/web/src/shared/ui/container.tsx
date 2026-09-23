import * as React from 'react';
import { cn } from '@/shared/lib/cn';

/** Responsive page container: consistent max width and gutters. */
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)} {...props} />
  );
}

/** Vertical section wrapper with the shared responsive rhythm. */
export function Section({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn('py-10 sm:py-14', className)} {...props} />;
}
