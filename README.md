# Casa Comigo

Aplicação completa em TanStack Start, React e Tailwind, com contas e dados no Lovable Cloud e pagamentos Mercado Pago. Não é apenas um frontend estático.

## Desenvolvimento e testes

Use Bun e o único lockfile, `bun.lock`:

```bash
bun install --frozen-lockfile
bun run dev
bun run test
```

## Configuração

As configurações públicas do navegador são `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`. Elas não são segredos.

No servidor, a aplicação usa `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET` e `ORDER_CONFIRM_SECRET`. Nunca criar versões `VITE_` de credenciais privadas. Os segredos devem ser cadastrados no armazenamento seguro da hospedagem, não em arquivos entregues ou no histórico do projeto.

O segredo de confirmação também precisa coincidir com o valor interno configurado no banco. Sua rotação exige atualização coordenada em todas as instalações, inclusive Vercel, para não interromper pagamentos. Não registrar nem imprimir valores de segredos.

As operações financeiras restritas usam também `SUPABASE_SERVICE_ROLE_KEY` no servidor. Essa credencial gerenciada não é exportável pelo Lovable Cloud: a instalação externa deve ter uma credencial legitimamente provisionada ou usar um serviço financeiro hospedado no Lovable. Não criar placeholders nem copiar credenciais de sessão para substituir essa chave. A presença dessa variável na Vercel não foi verificada.

O webhook exige `MERCADOPAGO_WEBHOOK_SECRET`, a assinatura fornecida pelo provedor, e responde 503 se ela estiver ausente e 401 para assinatura inválida. Isso não é o `ORDER_CONFIRM_SECRET`. Enquanto o segredo do provedor não estiver configurado, notificações não confirmarão pagamentos; configurar na instalação que recebe as notificações antes de considerar o fluxo financeiro pronto.

O `.env` é gerenciado pela plataforma e consta como rastreado neste checkout; não há confirmação de sua remoção do histórico. A limpeza precisa ser realizada pelo responsável pelo repositório, com eventual rotação de credenciais privadas que tenham sido expostas. Não copiar esse arquivo para ZIPs.

## Publicação

A configuração atual usa a integração gerenciada do Lovable e o destino Cloudflare padrão. Há execução no servidor para pedidos, pagamentos, conexão de contas e webhook em `/api/public/mercadopago-webhook`.

Publicar só uma pasta estática na Vercel não disponibiliza essas funções. Uma instalação Vercel requer um adaptador e saída de aplicação completa compatíveis com a versão instalada do TanStack/Nitro, além das variáveis de servidor, callback OAuth e webhook apontando para essa instalação. Essa instalação externa não foi validada aqui; não alterar o destino gerenciado do Lovable por suposição.

## Dados e pagamentos

Mudanças no banco são aplicadas pelas ferramentas de migração do Lovable; as mudanças atuais ficam em `drizzle/migrations`, e o histórico anterior em `supabase/migrations`. Não reaplicar manualmente todo o histórico num banco já existente.

Pix e cartões são cobrados pelo Mercado Pago. O cartão é tokenizado pelo provedor; número e CVV não são persistidos pela aplicação. Confirmação de presença exige um convite individual ligado ao convidado. As proteções e pendências financeiras estão registradas em `roadmap.md`.

## Backup antes de mudanças sensíveis

Verifique os snapshots em **More → Database → Manage → Backups**. Para preservar o estado atual, use **More → Database → Manage → Settings → Export project data**. Exportação e snapshots não incluem arquivos das fotos; estes são baixados separadamente em **More → Storage**. Não presumir que um backup específico existe sem consultar a interface.
