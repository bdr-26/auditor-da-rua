"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eraser, PenLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { signAudit } from "@/lib/signature-actions";
import { formatDateTimePT } from "@/lib/dates";
import { cn } from "@/lib/utils";

export interface SignatureInfo {
  nome: string;
  cpf: string;
  cargo: string;
  assinadaEm: string;
  imageUrl: string | null;
}

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Aprovação do supervisor da unidade: nome, CPF, cargo e assinatura desenhada no quadro (dedo ou caneta).
 * Mostra a assinatura já registrada; `canSign` permite registrar ou refazer.
 */
export function SignaturePad({ auditId, existing, canSign, supervisorNome }: { auditId: string; existing: SignatureInfo | null; canSign: boolean; supervisorNome?: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!existing);
  const [nome, setNome] = useState(existing?.nome ?? supervisorNome ?? "");
  const [cpf, setCpf] = useState(existing ? maskCpf(existing.cpf) : "");
  const [cargo, setCargo] = useState(existing?.cargo ?? "Supervisor(a)");
  const [drawn, setDrawn] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  // canvas em alta densidade, traço preto
  useEffect(() => {
    if (!editing) return;
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = 180;
    c.width = w * ratio;
    c.height = h * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172b";
  }, [editing]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setDrawn(true);
  };
  const up = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setDrawn(false);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = canvasRef.current;
    if (!c || !drawn) return setMsg({ ok: false, text: "Desenhe a assinatura no quadro." });
    setMsg(null);
    const png = c.toDataURL("image/png");
    start(async () => {
      const r = await signAudit(auditId, { nome, cpf, cargo, pngDataUrl: png });
      setMsg(r.ok ? { ok: true, text: r.message ?? "Assinatura registrada." } : { ok: false, text: r.error });
      if (r.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardTitle>
        <span className="inline-flex items-center gap-1.5">
          <PenLine className="h-4 w-4" /> Aprovação do supervisor da unidade
        </span>
      </CardTitle>

      {existing && !editing && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-green-900">
                {existing.nome} · {existing.cargo}
              </div>
              <div className="text-xs text-green-800">
                CPF {maskCpf(existing.cpf)} · assinado em {formatDateTimePT(existing.assinadaEm)}
              </div>
            </div>
          </div>
          {existing.imageUrl && (
            <div className="rounded-xl border border-line bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={existing.imageUrl} alt={`Assinatura de ${existing.nome}`} className="mx-auto h-24 object-contain" />
            </div>
          )}
          {canSign && (
            <button type="button" onClick={() => { setEditing(true); setDrawn(false); }} className="flex min-h-0 items-center gap-1 text-xs text-gray-500 hover:text-ink">
              <RotateCcw className="h-3.5 w-3.5" /> Refazer assinatura
            </button>
          )}
        </div>
      )}

      {!existing && !canSign && <p className="text-sm text-gray-500">Ainda sem assinatura do supervisor.</p>}

      {editing && canSign && (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-gray-600">Entregue o celular ao supervisor da unidade: ele confere o resultado, preenche os dados e assina no quadro.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome" className="col-span-2">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Nome completo" />
            </Field>
            <Field label="CPF">
              <Input value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} inputMode="numeric" required placeholder="000.000.000-00" />
            </Field>
            <Field label="Cargo">
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} required />
            </Field>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-sm font-medium">
              <span>Assinatura</span>
              <button type="button" onClick={clear} className="flex min-h-0 items-center gap-1 text-xs text-gray-500 hover:text-ink">
                <Eraser className="h-3.5 w-3.5" /> Limpar
              </button>
            </div>
            <canvas
              ref={canvasRef}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onPointerLeave={up}
              className={cn("block h-[180px] w-full touch-none rounded-xl border-2 border-dashed bg-white", drawn ? "border-ink" : "border-gray-300")}
              aria-label="Quadro de assinatura"
            />
          </div>
          {msg && <p className={cn("rounded-lg px-3 py-2 text-xs", msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{msg.text}</p>}
          <div className="flex gap-2">
            {existing && (
              <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={pending}>
                Cancelar
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={pending || !nome.trim() || cpf.replace(/\D/g, "").length !== 11}>
              {pending ? "Registrando…" : "Confirmar assinatura"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
