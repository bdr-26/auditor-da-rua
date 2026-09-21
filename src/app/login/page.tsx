import { APP_NAME } from "@/lib/constants";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-3xl font-black text-ink">A</div>
          <h1 className="text-2xl font-bold text-white">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-gray-400">Auditoria multilojas · Burger da Rua</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
