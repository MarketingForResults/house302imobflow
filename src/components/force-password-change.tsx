import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
    if (password.length < 8) return toast.error("A senha precisa ter no minimo 8 caracteres");
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
      toast.error(err.message ?? "Nao foi possivel atualizar a senha");
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
            senha pessoal para liberar o acesso ao sistema.
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
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
