# Roadmap

- [x] Ativar pagamento real (Mercado Pago) com o dono do site como intermediador de todos os presentes
- [x] Pix e cartões (débito à vista e crédito em até 12x) passam 100% pelo dono do site
- [x] Pedido criado no servidor com preço vindo do banco (navegador não envia valores)
- [x] Cartão tokenizado pelo Mercado Pago (número/CVV nunca chegam ao servidor nem ao banco)
- [x] Pix com QR Code do Mercado Pago + fallback gerado a partir do código, com botão copiar
- [x] Webhook confirma o pagamento e só então o pedido vira "pago" (e o presente conta como comprado)
- [x] Pedidos recusados/estornados voltam para cancelado pelo webhook
- [x] Banco: convidado não pode mais criar nem alterar pedidos direto pelo navegador
- [x] Comissão por casamento registrada em cada pedido (commission_cents) visível no super admin
- [ ] Fluxo de repasse aos noivos: descontar comissão e registrar valores a repassar (manual por enquanto)
- [x] Termos de uso e Política de privacidade (LGPD) públicos, com links no rodapé, login e cadastro
- [x] Cadastro self-service dos noivos (/criar-conta) criando o próprio casamento e virando dono
- [x] Central de novidades no painel dos noivos (presente pago / confirmação) + envio de resumo no WhatsApp
- [ ] Teste ponta a ponta com dinheiro real (o dono do site fará)
