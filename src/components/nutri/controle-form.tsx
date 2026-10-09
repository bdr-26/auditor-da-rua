"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, CheckCircle2, ChevronDown, Loader2, Lock, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { deleteControle, finalizeControle, reopenControle, saveControle, uploadControleFoto } from "@/lib/nutri-controles-actions";
import { compressImage } from "@/lib/photos/compress";
import {
  cabecalhoVisivel,
  camposDaLinha,
  getControleTipo,
  linhaPreenchida,
  linhaVisivel,
  nomesLinhasFixas,
  resumirControle,
  rotuloCampo,
  type Cabecalho,
  type Campo,
  type CatalogoCategoria,
  type ControleDados,
} from "@/lib/nutri/controle-tipos";
import type { NutriControle } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CatalogoItem = { nome: string; detalhe: string | null };
export type Catalogos = Partial<Record<CatalogoCategoria, CatalogoItem[]>>;

const OUTRO = "__outro__";

/** Texto com lista do catálogo: escolhe na lista ou "Outro…" e digita. */
function CatalogoInput({ value, opcoes, onChange, onDetalhe, disabled, placeholder, className }: { value: string; opcoes: CatalogoItem[]; onChange: (v: string) => void; onDetalhe?: (d: string | null) => void; disabled: boolean; placeholder?: string; className?: string }) {
  const naLista = opcoes.some((o) => o.nome === value);
  const [outro, setOutro] = useState(!!value && !naLista);
  if (opcoes.length === 0 || outro) {
    return (
      <div className={cn("flex gap-1", className)}>
        <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className="flex-1" />
        {opcoes.length > 0 && !disabled && (
          <button type="button" aria-label="Escolher da lista" onClick={() => { setOutro(false); onChange(""); }} className="flex h-10 w-10 min-h-0 shrink-0 items-center justify-center rounded-xl border border-line text-gray-500">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
  return (
    <Select
      value={value}
      className={className}
      onChange={(e) => {
        if (e.target.value === OUTRO) {
          setOutro(true);
          onChange("");
          onDetalhe?.(null);
          return;
        }
        onChange(e.target.value);
        onDetalhe?.(opcoes.find((o) => o.nome === e.target.value)?.detalhe ?? null);
      }}
      disabled={disabled}
    >
      <option value="">{placeholder ?? "—"}</option>
      {opcoes.map((o) => (
        <option key={o.nome} value={o.nome}>
          {o.nome}
        </option>
      ))}
      <option value={OUTRO}>Outro…</option>
    </Select>
  );
}

/** Número com sinal negativo e vírgula aceitos (teclado do celular não tem "−" no modo numérico). */
function NumeroInput({ value, onChange, disabled, sufixo }: { value: unknown; onChange: (v: number | null) => void; disabled: boolean; sufixo?: string }) {
  const [texto, setTexto] = useState(value == null ? "" : String(value).replace(".", ","));
  const commit = (t: string) => {
    setTexto(t);
    const limpo = t.replace(",", ".").trim();
    if (limpo === "" || limpo === "-") return onChange(null);
    const n = Number(limpo);
    if (!Number.isNaN(n)) onChange(n);
  };
  return (
    <div className="relative flex gap-1">
      <Input type="text" inputMode="decimal" pattern="-?[0-9]*[.,]?[0-9]*" value={texto} onChange={(e) => commit(e.target.value.replace(/[^0-9,.-]/g, ""))} disabled={disabled} className={cn("flex-1", sufixo && "pr-9")} placeholder="0,0" />
      {sufixo && <span className={cn("pointer-events-none absolute inset-y-0 flex items-center text-xs text-gray-500", disabled ? "right-3" : "right-14")}>{sufixo}</span>}
      {!disabled && (
        <button type="button" aria-label="Trocar o sinal" title="Negativo / positivo" onClick={() => commit(texto.startsWith("-") ? texto.slice(1) : `-${texto}`)} className="flex h-10 w-10 min-h-0 shrink-0 items-center justify-center rounded-xl border border-line text-sm font-semibold text-gray-600">
          ±
        </button>
      )}
    </div>
  );
}

/** Fotos: tira/escolhe, comprime, envia e guarda os caminhos. */
function FotoInput({ controleId, paths, urls, onChange, disabled }: { controleId: string; paths: string[]; urls: Record<string, string>; onChange: (paths: string[], urls: Record<string, string>) => void; disabled: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function add(files: FileList) {
    setBusy(true);
    setErro(null);
    const novos = [...paths];
    const novasUrls = { ...urls };
    for (const f of Array.from(files)) {
      try {
        const blob = await compressImage(f);
        const fd = new FormData();
        fd.set("file", blob, "foto.jpg");
        const r = await uploadControleFoto(controleId, fd);
        if (!r.ok) throw new Error(r.error);
        novos.push(r.path);
        novasUrls[r.path] = r.url;
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao enviar a foto.");
      }
    }
    onChange(novos, novasUrls);
    setBusy(false);
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {paths.map((p) => (
          <div key={p} className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-200">
            {urls[p] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[p]} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                <Camera className="h-5 w-5" />
              </div>
            )}
            {!disabled && (
              <button type="button" aria-label="Remover foto" onClick={() => onChange(paths.filter((x) => x !== p), urls)} className="absolute right-1 top-1 flex h-7 w-7 min-h-0 items-center justify-center rounded-full bg-black/60 text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-white text-xs font-medium text-gray-600">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {busy ? "enviando" : "Foto"}
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) void add(e.target.files); e.target.value = ""; }} />
      {erro && <p className="mt-1 text-[11px] text-red-700">{erro}</p>}
    </div>
  );
}

function CampoInput({ campo, value, onChange, disabled, catalogos, onDetalhe, controleId, fotoUrls, onFotoUrls }: { campo: Campo; value: unknown; onChange: (v: unknown) => void; disabled: boolean; catalogos: Catalogos; onDetalhe?: (d: string | null) => void; controleId: string; fotoUrls: Record<string, string>; onFotoUrls: (u: Record<string, string>) => void }) {
  const v = value == null ? "" : String(value);
  if (campo.tipo === "foto") {
    return <FotoInput controleId={controleId} paths={Array.isArray(value) ? value.map(String) : []} urls={fotoUrls} onChange={(p, u) => { onFotoUrls(u); onChange(p); }} disabled={disabled} />;
  }
  if (campo.catalogo) {
    return <CatalogoInput value={v} opcoes={catalogos[campo.catalogo] ?? []} onChange={onChange} onDetalhe={onDetalhe} disabled={disabled} placeholder={campo.placeholder} />;
  }
  if (campo.tipo === "select") {
    return (
      <Select value={v} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">—</option>
        {(campo.opcoes ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }
  if (campo.tipo === "bool") {
    return (
      <Select value={value === true ? "1" : value === false ? "0" : ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "1")} disabled={disabled}>
        <option value="">—</option>
        <option value="1">Sim</option>
        <option value="0">Não</option>
      </Select>
    );
  }
  if (campo.tipo === "number") return <NumeroInput value={value} onChange={onChange} disabled={disabled} sufixo={campo.sufixo} />;
  return <Input type={campo.tipo === "date" ? "date" : campo.tipo === "time" ? "time" : "text"} value={v} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={campo.placeholder} />;
}

/** Preenchimento genérico de um controle (planilha digital): cabeçalho + linhas, rascunho e finalização. */
export function ControleForm({ controle, tipoCodigo, inicial, unitName, canEdit, isChefe, catalogos = {}, fotoUrls: fotoUrlsIniciais = {} }: { controle: NutriControle; tipoCodigo: string; inicial: ControleDados; unitName: string; canEdit: boolean; isChefe: boolean; catalogos?: Catalogos; fotoUrls?: Record<string, string> }) {
  const router = useRouter();
  // definições (com funções de alerta) são resolvidas no cliente: não podem vir serializadas do servidor
  const tipo = getControleTipo(tipoCodigo)!;
  const [dados, setDados] = useState<ControleDados>(inicial);
  const [observacoes, setObservacoes] = useState(controle.observacoes ?? "");
  const [data, setData] = useState(controle.data);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>(fotoUrlsIniciais);
  const [pending, start] = useTransition();
  const finalizado = controle.status === "finalizado";
  const disabled = !canEdit || pending;
  const fixas = useMemo(() => new Set(nomesLinhasFixas(tipo)), [tipo]);
  const resumo = useMemo(() => resumirControle(tipo, dados), [tipo, dados]);
  const cab: Cabecalho = dados.cabecalho;
  const cabVisivel = cabecalhoVisivel(tipo, cab);
  const cabPrincipal = cabVisivel.filter((c) => !c.secao);
  const secoesCab = Array.from(new Set(cabVisivel.map((c) => c.secao).filter((s): s is string => !!s)));
  const [secoesAbertas, setSecoesAbertas] = useState<Set<string>>(() => new Set());
  const toggleSecao = (s: string) => setSecoesAbertas((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  // grupos de linhas (pasta sanitária, refeição de funcionário): seções recolhíveis
  const linhasVisiveis = dados.linhas.map((l, i) => ({ l, i })).filter(({ l }) => linhaVisivel(tipo, cab, l));
  const grupos = useMemo(() => Array.from(new Set(dados.linhas.map((l) => (typeof l.grupo === "string" ? l.grupo : null)).filter((g): g is string => !!g))), [dados.linhas]);
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(grupos.length <= 2 ? grupos : grupos.slice(0, 1)));
  const toggleGrupo = (g: string) => setAbertos((prev) => { const n = new Set(prev); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  const statusGrupo = (g: string) => {
    const ls = dados.linhas.filter((l) => l.grupo === g);
    const preenchidas = ls.filter((l) => linhaPreenchida(tipo, l)).length;
    const alertas = resumo.alertas.filter((a) => ls.some((l) => l.nome === a.linha)).length;
    return { total: ls.length, preenchidas, alertas };
  };

  const setCab = (k: string, v: unknown) => setDados((d) => ({ ...d, cabecalho: { ...d.cabecalho, [k]: v } }));
  const setLinha = (i: number, k: string, v: unknown) => setDados((d) => ({ ...d, linhas: d.linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const addLinha = (grupo?: string) =>
    setDados((d) => {
      const nova = grupo ? { nome: "", grupo, ...(d.linhas.find((l) => l.grupo === grupo && Array.isArray(l.campos)) ? { campos: d.linhas.find((l) => l.grupo === grupo && Array.isArray(l.campos))!.campos } : {}) } : { nome: "" };
      if (!grupo) return { ...d, linhas: [...d.linhas, nova] };
      const last = d.linhas.map((l) => l.grupo).lastIndexOf(grupo);
      const linhas = [...d.linhas];
      linhas.splice(last + 1, 0, nova);
      return { ...d, linhas };
    });
  const rmLinha = (i: number) => setDados((d) => ({ ...d, linhas: d.linhas.filter((_, j) => j !== i) }));

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Feito.") : (r.error ?? "Falha.") });
      if (r.ok) {
        setConfirmFinal(false);
        router.refresh();
      }
    });
  }
  const payload = () => ({ dados, observacoes, data });

  const renderCampo = (c: Campo, l: Record<string, unknown>, i: number) => {
    const v = l[c.key];
    const alerta = c.alerta && v != null && v !== "" ? c.alerta(v, l, cab) : null;
    return (
      <label key={c.key} className={cn("block", (c.tipo === "text" || c.tipo === "foto") && "col-span-2 sm:col-span-3")}>
        <span className="mb-0.5 block text-[11px] font-medium text-gray-600">
          {rotuloCampo(c, cab)}
          {c.obrigatorio ? " *" : ""}
        </span>
        <CampoInput campo={c} value={v} onChange={(nv) => setLinha(i, c.key, nv)} disabled={disabled} catalogos={catalogos} controleId={controle.id} fotoUrls={fotoUrls} onFotoUrls={setFotoUrls} />
        {alerta && <span className="mt-0.5 block text-[11px] font-semibold text-red-700">{alerta}</span>}
      </label>
    );
  };

  const renderCab = (c: Campo) => {
    const v = cab[c.key];
    const alerta = c.alerta && v != null && v !== "" ? c.alerta(v, {}, cab) : null;
    return (
      <Field key={c.key} label={rotuloCampo(c, cab) + (c.obrigatorio ? " *" : "")} className={c.tipo === "text" && !c.catalogo ? undefined : undefined}>
        <CampoInput campo={c} value={v} onChange={(nv) => setCab(c.key, nv)} onDetalhe={c.detalheEm ? (d) => setCab(c.detalheEm!, d ?? "") : undefined} disabled={disabled} catalogos={catalogos} controleId={controle.id} fotoUrls={fotoUrls} onFotoUrls={setFotoUrls} />
        {alerta && <span className="mt-0.5 block text-[11px] font-semibold text-red-700">{alerta}</span>}
      </Field>
    );
  };

  return (
    <div className="space-y-4">
      {tipo.base && <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-900">{tipo.base}</p>}

      {/* status / conferência */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={finalizado ? "green" : "yellow"}>{finalizado ? "finalizado" : "rascunho"}</Badge>
        <span className="text-gray-600">
          {resumo.linhasPreenchidas}/{resumo.linhasTotal} linha{resumo.linhasTotal === 1 ? "" : "s"} preenchida{resumo.linhasPreenchidas === 1 ? "" : "s"}
        </span>
        {resumo.alertas.length > 0 && (
          <Badge tone="red">
            <AlertTriangle className="h-3 w-3" /> {resumo.alertas.length} fora da faixa
          </Badge>
        )}
        {!canEdit && (
          <span className="inline-flex items-center gap-1 text-gray-500">
            <Lock className="h-3 w-3" /> somente leitura
          </span>
        )}
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={disabled} />
          </Field>
          <Field label="Unidade">
            <Input value={unitName} disabled />
          </Field>
          {cabPrincipal.map(renderCab)}
        </div>
        {secoesCab.map((s) => {
          const campos = cabVisivel.filter((c) => c.secao === s);
          const aberta = secoesAbertas.has(s);
          return (
            <div key={s} className="mt-3 rounded-xl border border-line">
              <button type="button" onClick={() => toggleSecao(s)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold">
                <span className="flex-1">{s}</span>
                <span className="text-xs font-normal text-gray-500">{campos.filter((c) => cab[c.key] != null && cab[c.key] !== "").length}/{campos.length}</span>
                <ChevronDown className={cn("h-4 w-4 text-gray-400 transition", aberta && "rotate-180")} />
              </button>
              {aberta && <div className="grid grid-cols-2 gap-3 border-t border-line p-3">{campos.map(renderCab)}</div>}
            </div>
          );
        })}
      </Card>

      <div className="space-y-2">
        {linhasVisiveis.map(({ l, i }, k) => {
          const grupo = typeof l.grupo === "string" ? l.grupo : null;
          const anterior = linhasVisiveis[k - 1]?.l;
          const novoGrupo = grupo && (k === 0 || anterior?.grupo !== grupo);
          const ultimoDoGrupo = grupo && linhasVisiveis[k + 1]?.l.grupo !== grupo;
          const recolhido = grupo ? !abertos.has(grupo) : false;
          const fixa = fixas.has(l.nome);
          if (grupo && recolhido && !novoGrupo) return null;
          const temValor = linhaPreenchida(tipo, l);
          const campos = camposDaLinha(tipo, l);
          const opcoesNome = tipo.nomeCatalogo ? (catalogos[tipo.nomeCatalogo] ?? []) : [];
          return (
            <div key={i}>
              {novoGrupo && (() => { const st = statusGrupo(grupo!); return (
                <button type="button" onClick={() => toggleGrupo(grupo!)} className={cn("mb-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold", st.alertas ? "border-red-200 bg-red-50/60" : st.preenchidas === st.total ? "border-green-200 bg-green-50/60" : "border-line bg-white")}>
                  <span className="flex-1">{grupo}</span>
                  <span className="text-xs font-normal text-gray-500">{st.preenchidas}/{st.total}{st.alertas ? ` · ${st.alertas} em alerta` : ""}</span>
                  <ChevronDown className={cn("h-4 w-4 text-gray-400 transition", !recolhido && "rotate-180")} />
                </button>
              ); })()}
              {!(grupo && recolhido) && (
                <Card className={cn("p-3", !temValor && "border-dashed")}>
                  <div className="mb-2 flex items-center gap-2">
                    {fixa ? (
                      <span className="flex-1 text-sm font-semibold">{grupo ? l.nome.replace(`${grupo} · `, "") : l.nome}</span>
                    ) : opcoesNome.length > 0 ? (
                      <CatalogoInput value={l.nome} opcoes={opcoesNome} onChange={(v) => setLinha(i, "nome", v)} disabled={disabled} placeholder={tipo.linhaLabel} className="flex-1 font-semibold" />
                    ) : (
                      <Input value={l.nome} onChange={(e) => setLinha(i, "nome", e.target.value)} disabled={disabled} placeholder={tipo.linhaLabel} className="flex-1 font-semibold" />
                    )}
                    {!fixa && canEdit && (
                      <button type="button" aria-label="Remover linha" onClick={() => rmLinha(i)} className="flex h-9 w-9 min-h-0 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-700">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{campos.map((c) => renderCampo(c, l, i))}</div>
                </Card>
              )}
              {grupo && ultimoDoGrupo && !recolhido && tipo.linhasLivres && canEdit && (
                <button type="button" onClick={() => addLinha(grupo)} disabled={pending} className="mt-2 flex min-h-0 items-center gap-1 text-xs font-medium text-brand-dark">
                  <Plus className="h-3.5 w-3.5" /> Incluir em {grupo}
                </button>
              )}
            </div>
          );
        })}
        {tipo.linhasLivres && canEdit && (
          <Button type="button" variant="secondary" full onClick={() => addLinha()} disabled={pending}>
            <Plus className="h-4 w-4" /> Adicionar {tipo.linhaLabel.toLowerCase()}
          </Button>
        )}
      </div>

      <Card>
        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} disabled={disabled} placeholder="Ocorrências, ações corretivas, quem acompanhou…" />
        </Field>
      </Card>

      {msg && <p className={cn("rounded-xl px-4 py-3 text-sm", msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{msg.text}</p>}

      {canEdit && !finalizado && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" disabled={pending} onClick={() => run(() => saveControle(controle.id, payload()))}>
              <Save className="h-4 w-4" /> Salvar rascunho
            </Button>
            <Button type="button" className="flex-1" disabled={pending} onClick={() => setConfirmFinal(true)}>
              <CheckCircle2 className="h-4 w-4" /> Finalizar
            </Button>
          </div>
          {confirmFinal && (
            <div className="rounded-xl border border-line bg-white p-3 text-sm">
              <p>Depois de finalizado, só a nutricionista chefe pode alterar. Confirmar?</p>
              {resumo.alertas.length > 0 && <p className="mt-1 text-xs text-red-700">Há {resumo.alertas.length} valor(es) fora da faixa; registre a ação corretiva nas observações.</p>}
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmFinal(false)} disabled={pending}>
                  Voltar
                </Button>
                <Button type="button" size="sm" className="flex-1" disabled={pending} onClick={() => run(() => finalizeControle(controle.id, payload()))}>
                  {pending ? "Finalizando…" : "Confirmar finalização"}
                </Button>
              </div>
            </div>
          )}
          <button type="button" onClick={() => run(() => deleteControle(controle.id))} disabled={pending} className="mx-auto flex min-h-0 items-center gap-1 text-xs text-gray-500 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Excluir rascunho
          </button>
        </div>
      )}

      {canEdit && finalizado && isChefe && (
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" disabled={pending} onClick={() => run(() => reopenControle(controle.id))}>
            <RotateCcw className="h-4 w-4" /> Reabrir
          </Button>
          <Button type="button" className="flex-1" disabled={pending} onClick={() => run(() => saveControle(controle.id, payload()))}>
            <Save className="h-4 w-4" /> Salvar alterações
          </Button>
        </div>
      )}
    </div>
  );
}
