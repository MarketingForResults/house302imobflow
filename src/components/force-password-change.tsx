import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { translatedErrorMessage } from "@/lib/error-messages";

const STRONG_PASSWORD_MESSAGE =
  "Use uma senha com pelo menos 10 caracteres, incluindo letra maiuscula, letra minuscula, numero e simbolo.";

function passwordStrengthError(value: string) {
  if (value.length < 10) return STRONG_PASSWORD_MESSAGE;
  if (!/[a-z]/.test(value)) return STRONG_PASSWORD_MESSAGE;
  if (!/[A-Z]/.test(value)) return STRONG_PASSWORD_MESSAGE;
  if (!/\d/.test(value)) return STRONG_PASSWORD_MESSAGE;
  if (!/[^A-Za-z0-9]/.test(value)) return STRONG_PASSWORD_MESSAGE;
  return null;
}

function passwordUpdateErrorMessage(error: any) {
  const text = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (text.includes("weak_password") || text.includes("weak password")) {
    return STRONG_PASSWORD_MESSAGE;
  }
  return translatedErrorMessage(error, "Nao foi possivel atualizar a senha");
}

export function ForcePasswordChange({
  userId,
  email,
  onDone,
}: {
  userId: string;
  email?: string | null;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const strengthError = passwordStrengthError(password);
    if (strengthError) return toast.error(strengthError);
    if (password !== confirm) return toast.error("As senhas nao conferem");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const { error: profileError } = await (supabase as any)
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", userId);
      if (profileError) throw profileError;
      toast.success("Senha atualizada com sucesso");
      onDone();
    } catch (err: any) {
      toast.error(passwordUpdateErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" /> Troque sua senha para continuar
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sua conta <strong>{email}</strong> esta usando uma senha provisoria. Defina uma nova
            senha pessoal forte para liberar o acesso ao sistema.
          </p>
          <div className="grid gap-1.5">
            <Label>Nova senha</Label>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
