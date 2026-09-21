"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Fila local de upload de fotos (IndexedDB) com retry automático.
 * A resposta já dada nunca se perde: a foto fica na fila até subir e ser registrada em audit_photos.
 */

const DB_NAME = "auditor-da-rua";
const STORE = "photo-uploads";

export interface QueuedPhoto {
  id: string; // uuid local
  answer_id: string;
  audit_id: string;
  path: string; // caminho no bucket audit-photos
  blob: Blob;
  attempts: number;
  created_at: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export async function enqueuePhoto(p: Omit<QueuedPhoto, "attempts" | "created_at">): Promise<void> {
  await tx("readwrite", (s) => s.put({ ...p, attempts: 0, created_at: Date.now() }));
}

export async function listQueued(auditId?: string): Promise<QueuedPhoto[]> {
  const all = await tx<QueuedPhoto[]>("readonly", (s) => s.getAll());
  return auditId ? all.filter((p) => p.audit_id === auditId) : all;
}

async function remove(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

/** Remove uma foto ainda na fila (antes de subir). */
export async function removeQueued(id: string): Promise<void> {
  await remove(id);
}

let flushing = false;

/**
 * Tenta subir tudo que está na fila. Retorna ids das fotos enviadas com sucesso.
 * Chamar após enfileirar, ao voltar online e ao abrir a auditoria.
 */
export async function flushQueue(onUploaded?: (p: QueuedPhoto, photoId: string) => void): Promise<string[]> {
  if (flushing) return [];
  flushing = true;
  const done: string[] = [];
  try {
    const supabase = createClient();
    const items = await listQueued();
    for (const p of items) {
      try {
        const { error: upErr } = await supabase.storage.from("audit-photos").upload(p.path, p.blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw upErr;
        const { data, error } = await supabase.from("audit_photos").insert({ answer_id: p.answer_id, storage_path: p.path }).select("id").single();
        if (error) throw error;
        await remove(p.id);
        done.push(p.id);
        onUploaded?.(p, data.id as string);
      } catch (e) {
        console.warn("[fotos] upload falhou, mantendo na fila", e);
        await tx("readwrite", (s) => s.put({ ...p, attempts: p.attempts + 1 }));
      }
    }
  } finally {
    flushing = false;
  }
  return done;
}

/** Agenda tentativas de reenvio: ao voltar online e periodicamente. Retorna função de cleanup. */
export function startQueueWorker(onUploaded?: (p: QueuedPhoto, photoId: string) => void): () => void {
  const run = () => void flushQueue(onUploaded);
  window.addEventListener("online", run);
  const timer = window.setInterval(run, 15_000);
  run();
  return () => {
    window.removeEventListener("online", run);
    window.clearInterval(timer);
  };
}
