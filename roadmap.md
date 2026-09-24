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

## Pedido 23/09 (fazer em partes, marcando ao concluir)
- [x] Cerimonialista: cadastro por casamento + % sobre o lucro da plataforma (ajustado no super admin)
- [x] Taxas padrão novas: <R$250 = 20%, R$250–1000 = 10%, >R$1000 = 5% (faixas continuam editáveis no super admin)
- [x] Termos: seção clara de taxas
- [x] Painel dos noivos: aba "Taxas" mostrando as faixas vigentes do casamento
- [x] Cadastro: checkbox obrigatório "concordo com as taxas"
- [x] Tutorial em PDF para os noivos, com link na página inicial antes de criar conta
- [x] Convite por QR: primeiro login pede nome completo + CPF → entra na lista de convidados; RSVP busca por CPF

## Pedido 24/09
- [x] Lista fechada dos noivos com CPF (importar/exportar planilha); busca por CPF só na lista fechada
- [x] Cadastro pelo QR vai para lista separada "perfis criados" (não entra na lista fechada)
- [x] Convite de cerimonialista (gerado pelos noivos ou super admin): ele se cadastra com Pix e fica ligado ao casamento
- [x] Cadastro: caixa de taxas agora é implícita (só link "termos de taxas") e deixa claro que não são descontadas dos presentes dos noivos
- [x] PDF tutorial: removida a seção de taxas e a menção de taxa no item "Recebimento"
- [x] Navegação do site: capa aparece só no início; páginas internas abrem diretamente no conteúdo escolhido
