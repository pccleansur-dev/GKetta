"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";

type PasswordFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function PasswordField({
  id,
  label,
  className = "field-input",
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="password-field-shell">
        <input {...props} id={id} type={visible ? "text" : "password"} className={className} />
        <button
          type="button"
          aria-label={visible ? "Ocultar contrasena" : "Ver contrasena"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="password-field-toggle"
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </div>
    </div>
  );
}
