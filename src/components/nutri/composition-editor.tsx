"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Pencil, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { CompositionArea, NutriBankItemWithUsage } from "@/lib/data/nutri";
import { addBankItemToUnit, copyComposition, createItemForUnit, moveArea, moveEntry, removeEntry, renameArea, setEntryStatus, setUnitRevisao } from "@/lib/nutri-actions";
import type { Unit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAction } from "./use-action";

export function CompositionEditor({ unit, areas, bank, otherUnits }: { unit: Unit; areas: CompositionArea[]; bank: NutriBankItemWithUsage[]; otherUnits: Unit[] }) {
  const { run, pending, error, info } = useAction();
  const [sheet, setSheet] = useState<{ mode: "bank" | "new"; area: string } | null>(null);
  const [copyFrom, setCopyFrom] = useState<string>("");
  const [showCopy, setShowCopy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ area: string; value: string } | null>(null);
  const areaNames = areas.map((a) => a.area);

  return (
    <div className="space-y-4">
      {/* status da revisão */}
      <div className={cn("card flex flex-wrap items-center justify-between gap-3", unit.nutri_checklist_em_revisao && "border-yellow-300 bg-yellow-50")}>
        <div>
          <div className="flex items-center gap-2 font-semibold">
            Checklist {unit.nutri_checklist_em_revisao ? <Badge tone="yellow">em revisão</Badge> : <Badge tone="green">validado</Badge>}
          </div>
          <p className="text-xs text-gray-600">
            {unit.nutri_checklist_em_revisao ? "A composição ainda precisa ser conferida pela nutricionista antes de virar padrão." : "Marque “em revisão” se a composição precisar de conferência."}
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => void run(() => setUnitRevisao(unit.id, !unit.nutri_checklist_em_revisao))}>
          {unit.nutri_checklist_em_revisao ? (
            <>
              <Check className="h-4 w-4" /> Marcar como validado
            </>
          ) : (
            "Marcar em revisão"
          )}
        </Button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {info && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{info}</p>}

      {/* áreas */}
      {areas.map((area, ai) => (
        <section key={area.area} className="card p-0">
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            {renaming?.area === area.area ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => renameArea(unit.id, area.area, renaming.value), (r) => r.ok && setRenaming(null));
                }}
              >
                <Input value={renaming.value} onChange={(e) => setRenaming({ area: area.area, value: e.target.value })} autoFocus className="py-2" />
                <Button type="submit" size="sm" disabled={pending}>
                  Salvar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <>
                <h2 className="min-w-0 flex-1 truncate font-semibold">
                  <span className="mr-1.5 text-xs text-gray-400">{ai + 1}.</span>
                  {area.area}
                </h2>
                <span className="text-xs text-gray-500">{area.entries.filter((e) => e.status === "ativo").length} ativos</span>
                <IconBtn label="Renomear área" onClick={() => setRenaming({ area: area.area, value: area.area })}>
                  <Pencil className="h-4 w-4" />
                </IconBtn>
                <IconBtn label="Subir área" disabled={ai === 0 || pending} onClick={() => void run(() => moveArea(unit.id, area.area, "up"))}>
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn label="Descer área" disabled={ai === areas.length - 1 || pending} onClick={() => void run(() => moveArea(unit.id, area.area, "down"))}>
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
              </>
            )}
          </header>
          <ul className="divide-y divide-line">
            {area.entries.map((entry, ei) => (
              <li key={entry.id} className={cn("px-4 py-3", entry.status === "pausado" && "bg-surface-muted")}>
                <div className="flex items-start gap-2">
                  <p className={cn("min-w-0 flex-1 text-sm leading-snug", entry.status === "pausado" && "text-gray-500")}>
                    <span className="mr-1 text-xs text-gray-400">{ei + 1}.</span>
                    {entry.item.descricao}
                  </p>
                  <div className="flex shrink-0 flex-col">
                    <IconBtn label="Subir" disabled={ei === 0 || pending} onClick={() => void run(() => moveEntry(entry.id, "up"))}>
                      <ArrowUp className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn label="Descer" disabled={ei === area.entries.length - 1 || pending} onClick={() => void run(() => moveEntry(entry.id, "down"))}>
                      <ArrowDown className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone={entry.status === "ativo" ? "green" : "gray"}>{entry.status}</Badge>
                  {!entry.item.ativo && <Badge tone="red">item desativado no banco</Badge>}
                  {entry.item.peso !== 1 && <span className="text-gray-500">peso {entry.item.peso}</span>}
                  <span className="text-gray-400">v{entry.item.versao}</span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void run(() => setEntryStatus(entry.id, entry.status === "ativo" ? "pausado" : "ativo"))}
                    className="min-h-0 rounded-lg px-2 py-1 font-medium text-gray-700 hover:bg-surface-muted"
                  >
                    {entry.status === "ativo" ? "Pausar" : "Reativar"}
                  </button>
                  {confirmRemove === entry.id ? (
                    <span className="flex items-center gap-1">
                      <span className="text-red-700">Retirar?</span>
                      <button type="button" disabled={pending} onClick={() => void run(() => removeEntry(entry.id), () => setConfirmRemove(null))} className="min-h-0 rounded-lg bg-red-600 px-2 py-1 font-semibold text-white">
                        Sim
                      </button>
                      <button type="button" onClick={() => setConfirmRemove(null)} className="min-h-0 rounded-lg px-2 py-1 font-medium">
                        Não
                      </button>
                    </span>
                  ) : (
                    <button type="button" disabled={pending} onClick={() => setConfirmRemove(entry.id)} className="min-h-0 rounded-lg px-2 py-1 font-medium text-red-700 hover:bg-red-50">
                      Retirar
                    </button>
                  )}
                </div>
              </li>
            ))}
            {area.entries.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">Área vazia.</li>}
          </ul>
          <footer className="flex gap-2 border-t border-line px-4 py-2">
            <button type="button" onClick={() => setSheet({ mode: "bank", area: area.area })} className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg text-sm font-medium text-brand-dark hover:bg-brand-light">
              <Plus className="h-4 w-4" /> Incluir do banco
            </button>
            <button type="button" onClick={() => setSheet({ mode: "new", area: area.area })} className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg text-sm font-medium text-gray-700 hover:bg-surface-muted">
              <Plus className="h-4 w-4" /> Criar item novo
            </button>
          </footer>
        </section>
      ))}

      {/* nova área / copiar */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={() => setSheet({ mode: "bank", area: "" })}>
          <Plus className="h-4 w-4" /> Nova área
        </Button>
        <Button variant="secondary" onClick={() => setShowCopy((v) => !v)} disabled={otherUnits.length === 0}>
          <Copy className="h-4 w-4" /> Copiar composição de outra unidade
        </Button>
      </div>
      {showCopy && (
        <div className="card space-y-3">
          <Field label="Unidade de origem" hint="Adiciona à composição atual só os itens que ainda não existem aqui.">
            <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Escolha…</option>
              {otherUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowCopy(false)}>
              Cancelar
            </Button>
            <Button disabled={!copyFrom || pending} onClick={() => void run(() => copyComposition(unit.id, copyFrom), (r) => r.ok && setShowCopy(false))}>
              Copiar
            </Button>
          </div>
        </div>
      )}

      {sheet && (
        <AddSheet
          mode={sheet.mode}
          initialArea={sheet.area}
          areas={areaNames}
          bank={bank}
          composition={areas}
          pending={pending}
          onClose={() => setSheet(null)}
          onAddBank={(bankItemId, area) => void run(() => addBankItemToUnit({ unitId: unit.id, bankItemId, area }))}
          onCreate={(descricao, area, peso) => void run(() => createItemForUnit({ unitId: unit.id, descricao, area, peso }), (r) => r.ok && setSheet(null))}
        />
      )}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="flex h-9 w-9 min-h-0 items-center justify-center rounded-full text-gray-600 hover:bg-surface-muted disabled:opacity-30">
      {children}
    </button>
  );
}

function AddSheet({
  mode,
  initialArea,
  areas,
  bank,
  composition,
  pending,
  onClose,
  onAddBank,
  onCreate,
}: {
  mode: "bank" | "new";
  initialArea: string;
  areas: string[];
  bank: NutriBankItemWithUsage[];
  composition: CompositionArea[];
  pending: boolean;
  onClose: () => void;
  onAddBank: (bankItemId: string, area: string) => void;
  onCreate: (descricao: string, area: string, peso: number) => void;
}) {
  const [tab, setTab] = useState(mode);
  const [areaSel, setAreaSel] = useState(initialArea || "__nova__");
  const [novaArea, setNovaArea] = useState("");
  const [q, setQ] = useState("");
  const [descricao, setDescricao] = useState("");
  const [peso, setPeso] = useState("1");
  const area = areaSel === "__nova__" ? novaArea.trim() : areaSel;

  const inArea = useMemo(() => new Set(composition.find((a) => a.area === area)?.entries.map((e) => e.bank_item_id) ?? []), [composition, area]);
  const candidates = useMemo(() => {
    const term = q.trim().toLowerCase();
    return bank.filter((b) => b.ativo && !inArea.has(b.id) && (!term || b.descricao.toLowerCase().includes(term) || b.area_padrao.toLowerCase().includes(term)));
  }, [bank, inArea, q]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose} role="dialog" aria-modal="true">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
            <button type="button" onClick={() => setTab("bank")} className={cn("min-h-0 rounded-lg px-3 py-1.5 text-sm font-medium", tab === "bank" ? "bg-white shadow-sm" : "text-gray-600")}>
              Do banco
            </button>
            <button type="button" onClick={() => setTab("new")} className={cn("min-h-0 rounded-lg px-3 py-1.5 text-sm font-medium", tab === "new" ? "bg-white shadow-sm" : "text-gray-600")}>
              Item novo
            </button>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="flex h-10 w-10 min-h-0 items-center justify-center rounded-full hover:bg-surface-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Área">
              <Select value={areaSel} onChange={(e) => setAreaSel(e.target.value)}>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                <option value="__nova__">Nova área…</option>
              </Select>
            </Field>
            {areaSel === "__nova__" && (
              <Field label="Nome da nova área">
                <Input value={novaArea} onChange={(e) => setNovaArea(e.target.value)} placeholder="Ex.: Área do Lixo" />
              </Field>
            )}
          </div>
        </div>

        {tab === "bank" ? (
          <>
            <div className="px-4 pb-2">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no banco…" className="pl-9" />
              </label>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-t border-line">
              {candidates.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{b.descricao}</p>
                    <p className="text-xs text-gray-500">
                      {b.area_padrao} · {b.unidades} unidade(s)
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" disabled={pending || !area} onClick={() => onAddBank(b.id, area)}>
                    Incluir
                  </Button>
                </li>
              ))}
              {candidates.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-500">{area ? "Nenhum item disponível para esta área." : "Escolha ou nomeie a área."}</li>}
            </ul>
          </>
        ) : (
          <form
            className="space-y-3 overflow-y-auto px-4 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              onCreate(descricao, area, Number(peso) || 1);
            }}
          >
            <Field label="Texto do item" hint="Redação em negativo: descreva o problema. O item entra no banco com esta área como padrão.">
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
            </Field>
            <Field label="Peso">
              <Input type="number" min={0.1} step={0.5} value={peso} onChange={(e) => setPeso(e.target.value)} />
            </Field>
            <Button type="submit" full disabled={pending || !descricao.trim() || !area}>
              Criar e incluir em “{area || "…"}”
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
