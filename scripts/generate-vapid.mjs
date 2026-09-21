// Gera um par de chaves VAPID para Web Push e imprime no formato do .env.local.
// Uso: node scripts/generate-vapid.mjs   (equivalente a: npx web-push generate-vapid-keys)
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log("# Cole no .env.local e nas variáveis de ambiente do Vercel / Supabase:");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:contato@burgerdarua.com.br");
