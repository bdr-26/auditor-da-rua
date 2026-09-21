// Cria os 4 usuários iniciais no Supabase Auth e garante os perfis. Idempotente.
// Uso: npm run seed:users   (lê .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_*)
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // sem .env.local: usa as variáveis já presentes no ambiente
}

type Role = "auditor_geral" | "auditor_nutricao" | "proprietario";
interface SeedUser {
  nome: string;
  role: Role;
  email: string;
  password: string;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Variável ${name} ausente (defina em .env.local).`);
    process.exit(1);
  }
  return v;
}

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const defaultPassword = required("SEED_DEFAULT_PASSWORD");

const users: SeedUser[] = [
  { nome: "Rodrigo", role: "auditor_geral", email: required("SEED_EMAIL_RODRIGO"), password: process.env.SEED_PASSWORD_RODRIGO ?? defaultPassword },
  { nome: "Daniele", role: "auditor_nutricao", email: required("SEED_EMAIL_DANIELE"), password: process.env.SEED_PASSWORD_DANIELE ?? defaultPassword },
  { nome: "Antonio", role: "proprietario", email: required("SEED_EMAIL_ANTONIO"), password: process.env.SEED_PASSWORD_ANTONIO ?? defaultPassword },
  { nome: "Victor", role: "proprietario", email: required("SEED_EMAIL_VICTOR"), password: process.env.SEED_PASSWORD_VICTOR ?? defaultPassword },
];

async function main() {
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // usuários existentes (por e-mail)
  const existing = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (u.email) existing.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
    page++;
  }

  const summary: { nome: string; email: string; role: Role; status: string }[] = [];
  for (const u of users) {
    const email = u.email.toLowerCase();
    let id = existing.get(email);
    let status = "já existia";
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: u.password,
        email_confirm: true,
        user_metadata: { nome: u.nome, role: u.role },
      });
      if (error) {
        // corrida/duplicidade: tenta localizar de novo
        if (/already|exists|registered/i.test(error.message)) {
          const { data: again } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          id = again?.users.find((x) => x.email?.toLowerCase() === email)?.id;
          status = "já existia";
        }
        if (!id) throw new Error(`falha ao criar ${email}: ${error.message}`);
      } else {
        id = data.user.id;
        status = "criado";
      }
    }
    // o trigger handle_new_user cria o perfil; garantimos nome/role/ativo mesmo assim
    const { error: pErr } = await admin.from("profiles").upsert({ id, nome: u.nome, email, role: u.role, ativo: true }, { onConflict: "id" });
    if (pErr) throw new Error(`falha ao gravar perfil de ${email}: ${pErr.message}`);
    summary.push({ nome: u.nome, email, role: u.role, status });
  }

  console.log("\nUsuários do Auditor da Rua:");
  console.table(summary);
  console.log("Senha padrão: SEED_DEFAULT_PASSWORD (troque no primeiro acesso).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
