import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props extends Omit<React.ComponentProps<"input">, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
}

export function CopyableInput({ value, onValueChange, ...rest }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = String(value ?? "").trim();
    if (!text) return toast.error("Nada para copiar");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Nao foi possivel copiar");
    }
  }

  return (
    <div className="flex gap-2">
      <Input {...rest} value={value ?? ""} onChange={(e) => onValueChange(e.target.value)} />
      <Button type="button" variant="outline" size="icon" onClick={copy} title="Copiar">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
