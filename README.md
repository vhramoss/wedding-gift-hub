# Lista de Presentes de Casamento

App em TanStack Start + React + Tailwind, com backend (Postgres/Auth) via Supabase.

## Rodar localmente
```bash
bun install   # ou npm install
bun run dev   # http://localhost:8080
```

## Variáveis de ambiente
Crie um arquivo `.env` na raiz com:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # apenas no servidor
```
Os valores atuais estão no painel do backend do projeto.

## Banco de dados
As migrações SQL estão em `supabase/migrations/`. Aplique-as no seu projeto Supabase
(via `supabase db push` ou colando o SQL no editor) antes do primeiro uso.

## Primeiro acesso
1. Crie sua conta em `/auth`.
2. Acesse `/admin` e clique em "Tornar-me administrador" (funciona só para o primeiro usuário).
3. Cadastre o casamento e os presentes na aba correspondente.

## Deploy na Vercel
1. Suba o repositório no GitHub e importe na Vercel.
2. Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.
3. Cadastre as variáveis de ambiente acima em Project Settings > Environment Variables.
4. O template está configurado para runtime edge (Cloudflare/Vercel Edge). Se a Vercel
   reclamar do preset, troque o target em `vite.config.ts` para o adaptador da Vercel
   (`@tanstack/react-start` suporta `target: 'vercel'`).

## Pagamentos
Pix gera o código Copia e Cola a partir da chave cadastrada pelos noivos.
Cartão/débito registram o pedido como pendente para conciliação manual no painel —
para captura automática, plugue um gateway (Stripe, Mercado Pago, Pagar.me) na etapa
de checkout em `src/routes/casamento.$slug.presente.$giftId.tsx`.
