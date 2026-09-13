import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('rounded-md border px-4 py-3 text-sm', {
  variants: {
    variant: {
      info: 'border-border bg-cream/40 text-ink',
      success: 'border-[#b7d7b0] bg-[#eef7ec] text-[#2f5d2a]',
      error: 'border-[#e3b7b7] bg-[#fbecec] text-[#8a2f2f]',
    },
  },
  defaultVariants: { variant: 'info' },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
