import Image from "next/image";
import { APP_NAME } from "@/lib/constants";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/brand/darua-food-inc.png" alt="Da Rua Food Inc" width={176} height={94} priority className="mb-4 h-20 w-auto" />
          <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-gray-500">Grupo Da Rua · Auditoria multilojas</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
