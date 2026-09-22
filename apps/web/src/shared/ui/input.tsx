import * as React from 'react';
import { cn } from '@/shared/lib/cn';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-caramel disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
