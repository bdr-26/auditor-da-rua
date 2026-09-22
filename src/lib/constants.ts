import type { AuditType, Score, UserRole } from "./types";

export const APP_NAME = "ROTA";
export const TIMEZONE = "America/Sao_Paulo";
export const BRAND_YELLOW = "#D59203";

export const SCORE_LABELS: Record<Score, string> = {
  5: "Padrão DA RUA",
  4: "Conforme",
  3: "Atenção",
  2: "Não conforme",
  1: "Crítico",
};

export const SCORE_HINTS: Record<Score, string> = {
  5: "Impecável, serve de referência para a rede",
  4: "Dentro do padrão",
  3: "Funciona, mas com desvios visíveis",
  2: "Fora do padrão, exige correção",
  1: "Falha grave",
};

/** Classes Tailwind do semáforo de notas (seção 6). */
export const SCORE_COLORS: Record<Score, { bg: string; text: string; ring: string; solid: string }> = {
  5: { bg: "bg-green-100", text: "text-green-800", ring: "ring-green-500", solid: "bg-green-600" },
  4: { bg: "bg-green-50", text: "text-green-700", ring: "ring-green-400", solid: "bg-green-500" },
  3: { bg: "bg-yellow-100", text: "text-yellow-800", ring: "ring-yellow-500", solid: "bg-yellow-400" },
  2: { bg: "bg-orange-100", text: "text-orange-800", ring: "ring-orange-500", solid: "bg-orange-500" },
  1: { bg: "bg-red-100", text: "text-red-800", ring: "ring-red-500", solid: "bg-red-600" },
};

export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  completa: "Auditoria Completa",
  simplificada: "Auditoria Simplificada",
  producao: "Auditoria de Produção",
  nutricional: "Auditoria Nutricional",
};

export const AUDIT_TYPE_SHORT: Record<AuditType, string> = {
  completa: "Completa",
  simplificada: "Simplificada",
  producao: "Produção",
  nutricional: "Nutricional",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  auditor_geral: "Gerente geral",
  auditor_nutricao: "Nutricionista",
  proprietario: "Proprietário",
};

/** Pesos das auditorias do gerente na nota mensal (seção 11). */
export const AUDIT_WEIGHTS: Record<Exclude<AuditType, "nutricional">, number> = {
  completa: 2,
  simplificada: 1,
  producao: 1,
};

export const PHOTO_REQUIRED_MAX_SCORE = 2; // notas 1 e 2 exigem foto
export const GRAVE_FAILURE_CAP = 50; // nota máxima do dia com falha grave
export const ELIGIBILITY_MIN = 70;
export const REDUCED_SAMPLE_MIN = 3;
export const PRIZE_VALUE = 200;
export const RECURRENCE_VISITS = 2;

export const NUTRI_BANDS = [
  { nome: "Excelente", min: 91 },
  { nome: "Satisfatório", min: 80 },
  { nome: "Insatisfatório", min: 50 },
  { nome: "Crítico", min: 0 },
] as const;

/** Posições da rotação semanal: qua..dom (0=qua). Terça = produção fixa. */
export const ROTATION_DAYS: { weekday: number; tipo: Exclude<AuditType, "nutricional" | "producao">; label: string }[] = [
  { weekday: 3, tipo: "simplificada", label: "Quarta" },
  { weekday: 4, tipo: "simplificada", label: "Quinta" },
  { weekday: 5, tipo: "completa", label: "Sexta" },
  { weekday: 6, tipo: "completa", label: "Sábado" },
  { weekday: 0, tipo: "completa", label: "Domingo" },
];
