/** Painel de diagnóstico exibido quando o carregamento de uma tela falha (mensagem real do erro). */
export function ErrorPanel({ title, error }: { title: string; error: unknown }) {
  const e = error as { message?: string; stack?: string; code?: string; details?: string; hint?: string };
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 break-words">{e?.message ?? String(error)}</p>
      {(e?.code || e?.details || e?.hint) && (
        <p className="mt-1 text-xs text-red-800">{[e.code, e.details, e.hint].filter(Boolean).join(" · ")}</p>
      )}
      {e?.stack && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-red-800">{e.stack}</pre>}
    </div>
  );
}
