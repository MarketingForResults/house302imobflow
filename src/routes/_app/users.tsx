/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, Trash2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { translatedErrorMessage } from "@/lib/error-messages";
import {
  createAppUser,
  deleteAppUser,
  listAppUsers,
  resetAppUserPassword,
  updateAppUserRole,
} from "@/lib/users-admin.functions";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

const ROLE_OPTIONS: AppRole[] = ["admin", "manager", "financial", "broker", "owner", "tenant"];

function generateTempPassword() {
  const part = Math.random().toString(36).slice(-6);
  return `House@${part}`;
}

function UsersPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();
  const list = useServerFn(listAppUsers);
  const createUser = useServerFn(createAppUser);
  const updateRole = useServerFn(updateAppUserRole);
  const resetPass = useServerFn(resetAppUserPassword);
  const removeUser = useServerFn(deleteAppUser);

  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    role: "broker" as AppRole,
    temporaryPassword: generateTempPassword(),
  });
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["app-users"],
    enabled: isAdmin,
    queryFn: async () => (await (list as any)()) as any,
  });

  const createMut = useMutation({
    mutationFn: async () => (await createUser({ data: form })) as any,
    onSuccess: (res) => {
      setCreatedInfo({ email: res.email, password: res.temporaryPassword });
      setOpenNew(false);
      setForm({
        email: "",
        fullName: "",
        role: "broker",
        temporaryPassword: generateTempPassword(),
      });
      qc.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (e: any) => toast.error(translatedErrorMessage(e, "Nao foi possivel criar o usuario.")),
  });

  const roleMut = useMutation({
    mutationFn: async (input: { userId: string; role: AppRole }) =>
      (await updateRole({ data: input })) as any,
    onSuccess: () => {
      toast.success("Categoria atualizada");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (e: any) => toast.error(translatedErrorMessage(e)),
  });

  const resetMut = useMutation({
    mutationFn: async (userId: string) =>
      (await resetPass({
        data: { userId, temporaryPassword: generateTempPassword() },
      })) as any,
    onSuccess: (res, _userId) => {
      setCreatedInfo({ email: "(senha redefinida)", password: res.temporaryPassword });
      qc.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (e: any) => toast.error(translatedErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: async (userId: string) => (await removeUser({ data: { userId } })) as any,
    onSuccess: () => {
      toast.success("Usuario removido");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (e: any) => toast.error(translatedErrorMessage(e)),
  });

  if (!isAdmin) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Apenas administradores podem acessar esta area.
      </div>
    );
  }

  const users = (data?.users ?? []) as any[];

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Gerencie acessos do sistema com senhas temporarias e categorias de permissao"
        actions={
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo usuario
          </Button>
        }
      />

      <div className="p-4 md:p-8">
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Usuario</th>
                <th className="px-4 py-2">Categoria</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Ultimo acesso</th>
                <th className="px-4 py-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading && users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhum usuario cadastrado ainda.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const primary = (u.roles?.[0] ?? "broker") as AppRole;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.full_name || u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={primary}
                        onValueChange={(v) => roleMut.mutate({ userId: u.id, role: v as AppRole })}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {u.must_change_password ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">
                          Senha provisoria
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <ShieldCheck className="mr-1 h-3 w-3" /> Ativo
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mr-1"
                        onClick={() => resetMut.mutate(u.id)}
                        disabled={resetMut.isPending}
                        title="Gerar nova senha temporaria"
                      >
                        <KeyRound className="mr-1 h-3.5 w-3.5" /> Nova senha
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Remover usuario ${u.email}?`)) deleteMut.mutate(u.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuario</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label>Nome completo</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Categoria de acesso</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as AppRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Senha temporaria</Label>
              <div className="flex gap-2">
                <Input
                  value={form.temporaryPassword}
                  onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setForm({ ...form, temporaryPassword: generateTempPassword() })
                  }
                >
                  Gerar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O usuario sera obrigado a trocar a senha no primeiro acesso.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNew(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.email || !form.fullName}
            >
              Criar usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdInfo} onOpenChange={(o) => !o && setCreatedInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credenciais de acesso geradas</DialogTitle>
          </DialogHeader>
          {createdInfo && (
            <div className="space-y-2 text-sm">
              <p>
                Compartilhe com seguranca. O usuario sera obrigado a trocar a senha no primeiro
                login.
              </p>
              <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs">
                <div>E-mail: {createdInfo.email}</div>
                <div>Senha provisoria: {createdInfo.password}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `E-mail: ${createdInfo.email}\nSenha provisoria: ${createdInfo.password}`,
                  );
                  toast.success("Credenciais copiadas");
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" /> Copiar
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreatedInfo(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
