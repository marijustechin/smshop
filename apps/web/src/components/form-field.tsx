import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Optional control rendered inside the field's right edge (for example a password reveal). */
  endAdornment?: React.ReactNode;
}

export function FormField({
  id,
  label,
  error,
  hint,
  className,
  endAdornment,
  ...props
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(endAdornment ? 'pr-10' : undefined, className)}
          {...props}
        />
        {endAdornment ? (
          <span className="absolute inset-y-0 right-0 flex items-center pr-1">{endAdornment}</span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-[#8a2f2f]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className={cn('text-sm text-[#8a2f2f]')}>
      {children}
    </p>
  );
}
