// Renderização dos documentos em Buffer (Node). Sem "server-only" de propósito: usado também pelo
// script scripts/render-report-sample.tsx. Nunca importar em código de edge runtime ou do browser.
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { ConsolidadoReportDocument } from "./consolidado-report";
import { LojaReportDocument } from "./loja-report";
import { NutriAuditReportDocument } from "./nutri-audit-report";
import { NutriMonthlyReportDocument } from "./nutri-monthly-report";
import type { NutriAuditReportData, NutriMonthlyReportData } from "./nutri-types";
import type { ConsolidadoReportData, LojaReportData } from "./types";

type DocElement = ReactElement<DocumentProps>;

export async function renderLojaReport(data: LojaReportData): Promise<Buffer> {
  return renderToBuffer(createElement(LojaReportDocument, { data }) as unknown as DocElement);
}

export async function renderConsolidadoReport(data: ConsolidadoReportData): Promise<Buffer> {
  return renderToBuffer(createElement(ConsolidadoReportDocument, { data }) as unknown as DocElement);
}

export async function renderNutriAuditReport(data: NutriAuditReportData): Promise<Buffer> {
  return renderToBuffer(createElement(NutriAuditReportDocument, { data }) as unknown as DocElement);
}

export async function renderNutriMonthlyReport(data: NutriMonthlyReportData): Promise<Buffer> {
  return renderToBuffer(createElement(NutriMonthlyReportDocument, { data }) as unknown as DocElement);
}
