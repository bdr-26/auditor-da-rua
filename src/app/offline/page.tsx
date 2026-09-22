import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export const metadata = { title: "Sem conexão" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-6 text-center">
      <h1 className="text-2xl font-bold">{APP_NAME}</h1>
      <p className="mt-3 max-w-sm text-sm text-gray-600">Sem conexão com a internet. Assim que a conexão voltar, toque em recarregar. As respostas já dadas ficam salvas.</p>
      <Link href="/" className="mt-6 rounded-xl bg-brand px-5 py-3 font-semibold text-white">
        Recarregar
      </Link>
    </main>
  );
}
