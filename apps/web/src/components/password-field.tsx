'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { FormField } from './form-field';

type PasswordFieldProps = Omit<React.ComponentProps<typeof FormField>, 'type' | 'endAdornment'>;

/**
 * Password input with an accessible show/hide toggle. The toggle only changes
 * the input `type`; it never touches the field value, so validation and
 * `react-hook-form` registration are unaffected. Keyboard operable and labelled
 * with its action, with `aria-pressed` exposing the current visibility state.
 */
export function PasswordField({ id, label, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = React.useState(false);
  const toggleLabel = visible ? 'Slėpti slaptažodį' : 'Rodyti slaptažodį';

  return (
    <FormField
      id={id}
      label={label}
      type={visible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={toggleLabel}
          aria-pressed={visible}
          aria-controls={id}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-caramel"
        >
          {visible ? (
            <Eye aria-hidden="true" className="h-4 w-4" />
          ) : (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      }
      {...props}
    />
  );
}
