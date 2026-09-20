import React, { useId } from "react";
import { AlertCircle } from "lucide-react";

interface FieldShellProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean | undefined; "aria-describedby": string | undefined }) => React.ReactNode;
}

function FieldShell({ label, required, error, hint, children }: FieldShellProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required" aria-hidden> *</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": error || hint ? messageId : undefined })}
      {error ? (
        <span id={messageId} className="field-error" role="alert">
          <AlertCircle size={14} aria-hidden /> {error}
        </span>
      ) : (
        hint && <span id={messageId} className="field-hint">{hint}</span>
      )}
    </div>
  );
}

type FieldOwnProps = { label: string; error?: string; hint?: string };

export function Input({
  label, error, hint, required, className = "", ...rest
}: FieldOwnProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      {(aria) => <input {...rest} {...aria} required={required} className={`input ${className}`} />}
    </FieldShell>
  );
}

export function Select({
  label, error, hint, required, children, className = "", ...rest
}: FieldOwnProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      {(aria) => (
        <select {...rest} {...aria} required={required} className={`select ${className}`}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}
