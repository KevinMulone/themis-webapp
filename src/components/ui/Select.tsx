import { forwardRef } from 'react';
import { FieldLabel, FieldHint } from './Field';

/** Un menù a tendina con la stessa cornice di un Field, per coerenza visiva. */
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string; hint?: string; full?: boolean;
}>(function Select({ label, hint, full = false, className = '', children, ...props }, ref) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      {label && <FieldLabel required={props.required}>{label}</FieldLabel>}
      <select
        ref={ref}
        className={`w-full rounded-md border border-neutral-300 px-3 py-2 text-sm ${className}`.trim()}
        {...props}
      >
        {children}
      </select>
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
});
