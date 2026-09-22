import { CalendarClock, MessageSquare, Store, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { DEMANDA_STATUS_LABELS } from "@/lib/constants";
import type { DemandaDetail as Detail } from "@/lib/data/demandas";
import { formatDatePT, formatDateTimePT } from "@/lib/dates";
import { Attachments, CommentForm, ConcludeForm, OwnerActions, StatusButtons } from "./demanda-actions";
import { DemandaStatusBadge, prazoLabel } from "./demanda-card";

/** Página de uma demanda (compartilhada entre gerente e proprietário; muda só o que cada um pode fazer). */
export function DemandaDetailView({ detail, viewerRole, viewerId }: { detail: Detail; viewerRole: "auditor_geral" | "proprietario"; viewerId: string }) {
  const { demanda: d, unit, comentarios, anexos, responsavel, criador } = detail;
  const isOwner = viewerRole === "proprietario";
  const encerrada = d.status === "concluida" || d.status === "cancelada";
  const canEdit = isOwner || d.responsavel_id === viewerId;
  const pessoal = d.criado_por === d.responsavel_id;
  const canManage = isOwner || d.criado_por === viewerId;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <DemandaStatusBadge d={d} />
          {d.prioridade === "alta" && <Badge tone="red">prioridade alta</Badge>}
          {pessoal && <Badge tone="gray">pessoal</Badge>}
        </div>
        <h2 className="mt-2 text-xl font-bold leading-tight">{d.titulo}</h2>
        {d.descricao && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{d.descricao}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span>{encerrada && d.prazo ? `prazo ${formatDatePT(d.prazo)}` : prazoLabel(d.prazo)}</span>
          </div>
          {unit && (
            <div className="flex items-center gap-2 text-gray-600">
              <Store className="h-4 w-4 shrink-0" />
              <span className="truncate">{unit.nome}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">Responsável: {responsavel?.nome ?? "—"}</span>
          </div>
          <div className="text-xs text-gray-500">
            criada por {criador?.nome ?? "—"} em {formatDateTimePT(d.created_at)}
          </div>
        </dl>
        {d.status === "concluida" && (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm">
            <div className="font-semibold text-green-800">Concluída{d.concluida_em ? ` em ${formatDateTimePT(d.concluida_em)}` : ""}</div>
            <p className="mt-1 whitespace-pre-wrap text-green-900">{d.conclusao_texto}</p>
          </div>
        )}
      </Card>

      {!isOwner && !encerrada && (
        <Card>
          <CardTitle>Situação atual</CardTitle>
          <StatusButtons d={d} />
        </Card>
      )}

      <Card>
        <CardTitle>Anexos {anexos.length > 0 && <span className="text-gray-400">({anexos.length})</span>}</CardTitle>
        <Attachments d={d} anexos={anexos} canEdit={canEdit && !encerrada} />
      </Card>

      <Card>
        <CardTitle>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-4 w-4" /> Andamento
          </span>
        </CardTitle>
        {comentarios.length === 0 ? (
          <p className="text-sm text-gray-500">Sem comentários ainda.</p>
        ) : (
          <ul className="space-y-3">
            {comentarios.map((c) => (
              <li key={c.id} className="rounded-xl bg-surface-muted p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{c.autor}</span>
                  <span>{formatDateTimePT(c.created_at)}</span>
                  {c.status_novo && <Badge tone={c.status_novo === "concluida" ? "green" : c.status_novo === "cancelada" ? "gray" : "yellow"}>{DEMANDA_STATUS_LABELS[c.status_novo]}</Badge>}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.texto}</p>
              </li>
            ))}
          </ul>
        )}
        {canEdit && !encerrada && (
          <div className="mt-3">
            <CommentForm demandaId={d.id} />
          </div>
        )}
      </Card>

      {!isOwner && <ConcludeForm d={d} />}
      {canManage && (
        <div className="flex justify-end">
          <OwnerActions d={d} />
        </div>
      )}
    </div>
  );
}
