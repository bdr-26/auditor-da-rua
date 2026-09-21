/** Estado local do preenchimento (client). */

export interface LocalPhoto {
  /** id local (uuid da fila) ou id da linha em audit_photos */
  key: string;
  /** id em audit_photos quando já registrada */
  id: string | null;
  path: string;
  /** object URL (foto recém-tirada) ou URL assinada (foto já enviada) */
  url: string | null;
  /** ainda na fila local de upload */
  queued: boolean;
}

export interface LocalAnswer {
  id: string;
  item_id: string;
  nota: number | null;
  na: boolean;
  produto_vencido: boolean;
  observacao: string;
  photos: LocalPhoto[];
}

export interface LocalPending {
  pending_issue_id: string;
  resolvida: boolean | null;
  observacao: string;
  descricao: string;
  nota_origem: number | null;
  observacao_origem: string | null;
  visitas_sem_resolver: number;
  reincidente: boolean;
  origem_data: string | null;
}

export type SaveState = "idle" | "saving" | "saved" | "error";
