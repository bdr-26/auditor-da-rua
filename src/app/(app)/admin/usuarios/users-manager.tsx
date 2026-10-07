"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, UserCheck, UserX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { NUTRI_NIVEL_LABELS, ROLE_LABELS } from "@/lib/constants";
import { createUserAction, resetPasswordAction, setUserActiveAction, updateUserAction, type UserInput, type UsersResult } from "@/lib/users-actions";
import type { NutriNivel, Profile, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: UserRole[] = ["auditor_geral", "auditor_nutricao", "proprietario"];

export function UsersManager({ users, meId }: { users: Profile[]; meId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<{ kind: "new" } | { kind: "edit"; user: Profile } | { kind: "senha"; user: Profile } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<UsersResult>, close = true) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "Feito." } : { ok: false, text: r.error });
      if (r.ok) {
        router.refresh();
        if (close) setMode(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setMode({ kind: "new" })} disabled={pending}>
          <Plus className="h-4 w-4" /> Novo acesso
        </Button>
        {msg && <span className={cn("rounded-lg px-3 py-1.5 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</span>}
      </div>

      {mode?.kind === "new" && <UserForm onCancel={() => setMode(null)} pending={pending} onSubmit={(input) => run(() => createUserAction(input))} />}
      {mode?.kind === "edit" && <UserForm user={mode.user} onCancel={() => setMode(null)} pending={pending} onSubmit={(input) => run(() => updateUserAction(mode.user.id, input))} />}
      {mode?.kind === "senha" && <PasswordForm user={mode.user} onCancel={() => setMode(null)} pending={pending} onSubmit={(senha) => run(() => resetPasswordAction(mode.user.id, senha))} />}

      <Card className="p-0">
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !u.ativo && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{u.nome}</span>
                  {u.id === meId && <Badge tone="gray">você</Badge>}
                  <Badge tone={u.ativo ? "green" : "red"}>{u.ativo ? "ativo" : "desativado"}</Badge>
                </div>
                <div className="text-xs text-gray-500">
                  {u.email} · {ROLE_LABELS[u.role]}
                  {u.role === "auditor_nutricao" && u.nutri_nivel ? ` · ${NUTRI_NIVEL_LABELS[u.nutri_nivel]}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" aria-label="Editar" title="Editar" onClick={() => setMode({ kind: "edit", user: u })} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-muted">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" aria-label="Nova senha" title="Nova senha" onClick={() => setMode({ kind: "senha", user: u })} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-muted">
                  <KeyRound className="h-4 w-4" />
                </button>
                {u.id !== meId && (
                  <button
                    type="button"
                    aria-label={u.ativo ? "Desativar" : "Reativar"}
                    title={u.ativo ? "Desativar acesso" : "Reativar acesso"}
                    disabled={pending}
                    onClick={() => run(() => setUserActiveAction(u.id, !u.ativo), false)}
                    className={cn("flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-muted", u.ativo ? "text-red-700" : "text-green-700")}
                  >
                    {u.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-gray-500">O colaborador entra com o e-mail e a senha inicial que você informar. Estagiárias de nutrição veem só o que elas mesmas fizeram; a nutricionista chefe vê e edita tudo do módulo.</p>
    </div>
  );
}

function UserForm({ user, pending, onCancel, onSubmit }: { user?: Profile; pending: boolean; onCancel: () => void; onSubmit: (input: UserInput) => void }) {
  const [nome, setNome] = useState(user?.nome ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<UserRole>(user?.role ?? "auditor_nutricao");
  const [nivel, setNivel] = useState<NutriNivel>(user?.nutri_nivel ?? "estagiaria");
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ nome, email, senha: user ? undefined : senha, role, nutri_nivel: role === "auditor_nutricao" ? nivel : null });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{user ? `Editar ${user.nome}` : "Novo acesso"}</h2>
        <button type="button" aria-label="Fechar" onClick={onCancel} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Field>
        <Field label="E-mail" hint={user ? "O e-mail não pode ser alterado aqui." : undefined}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!!user} />
        </Field>
        {!user && (
          <Field label="Senha inicial" hint="Mínimo 8 caracteres. Informe ao colaborador.">
            <Input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} autoComplete="off" />
          </Field>
        )}
        <Field label="Perfil">
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        {role === "auditor_nutricao" && (
          <Field label="Nível na nutrição">
            <Select value={nivel} onChange={(e) => setNivel(e.target.value as NutriNivel)}>
              <option value="estagiaria">Estagiária</option>
              <option value="chefe">Nutricionista chefe</option>
            </Select>
          </Field>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : user ? "Salvar" : "Criar acesso"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function PasswordForm({ user, pending, onCancel, onSubmit }: { user: Profile; pending: boolean; onCancel: () => void; onSubmit: (senha: string) => void }) {
  const [senha, setSenha] = useState("");
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(senha);
      }}
    >
      <h2 className="text-base font-semibold">Nova senha para {user.nome}</h2>
      <Field label="Senha" hint="Mínimo 8 caracteres. A senha antiga deixa de valer na hora.">
        <Input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} autoComplete="off" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || senha.length < 8}>
          {pending ? "Salvando…" : "Redefinir senha"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
