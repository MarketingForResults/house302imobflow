import * as React from "react";
import PhoneInputBase from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

export interface PhoneInputProps {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
  defaultCountry?: string;
  id?: string;
}

/**
 * International phone input with country code selector.
 * Stores value in E.164 format (e.g. "+5535996775825").
 */
export function PhoneInput({
  value,
  onChange,
  disabled,
  placeholder,
  autoComplete = "tel",
  className,
  defaultCountry = "BR",
  id,
}: PhoneInputProps) {
  return (
    <PhoneInputBase
      id={id}
      international
      countryCallingCodeEditable={false}
      defaultCountry={defaultCountry as any}
      value={value ?? undefined}
      onChange={(v) => onChange(v ?? "")}
      disabled={disabled}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={cn("lovable-phone-input", className)}
      numberInputProps={{
        className:
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      }}
    />
  );
}
