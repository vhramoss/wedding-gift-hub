# Roadmap

## Pedido 22/11 — entrada dos convidados e revisão completa
- [x] Organizar a aba Convidados: seções Lista/Convites/Perfis/Acessos; seleção de convite individual no topo, lista em páginas de 20, configuração e lembretes recolhidos; verificado como gestor em computador e celular sem transbordamento.
- [x] Login: direcionar ao casamento vinculado pelo convite, mesmo sem presença ou presente anterior; preservar destinos internos de convites. RPC autenticada my_invited_weddings e testes de destino seguro.
- [x] Primeiro acesso: permitir visitar o casamento e confirmar presença depois, sem registrar resposta automaticamente. Conta temporária resgatou convite, visitou site e retornou via /auth; attending e responded_at continuaram nulos.
- [ ] Auditar proteções já aplicadas e concluir validações pendentes de pagamento, assinatura e acesso; registrar separadamente dependências externas.
- [ ] Atualizar a instalação GitHub/Vercel e validar o fluxo convidado real de teste; não afirmar conclusão de itens não exercitados.

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
- [x] Música: sincronizar o início automático do YouTube e repetir após a primeira interação permitida pelo navegador
- [x] Capa: permitir que os noivos personalizem o título sem alterar os nomes do cadastro

## Pedido 24/09 — fundos prontos para a capa
- [x] Criar seis imagens nativas variadas para casamento
- [x] Adicionar escolha visual com prévia imediata na área “Capa e música”
- [x] Salvar o fundo escolhido junto com os demais ajustes da capa

- [x] 24/09 Capa: enviar foto da galeria/câmera; revisão completa no celular (menu do site do casamento, abas do painel e super admin)

## Pedido 24/09 — pedidos, prévia e tipografia
- [x] Pedidos: impedir valores e datas inválidos e reorganizar os dados para celular
- [x] Aparência: prévia fiel à capa pública
- [x] Tipografia: fonte decorativa somente em títulos e capa; textos em fonte legível
- [x] Verificar no celular a aba Pedidos, a prévia e o site público

## Pedido 24/09 — conta dos noivos
- [x] Permitir alterar os nomes cadastrados do casal e o nome pessoal da conta na área dos noivos
- [x] Verificar a alteração e a visualização no celular

## Pedido 04/10
- [x] Menu do site: destacar a página atual
- [x] Botão casinha ao lado da música (voltar ao início)
- [x] Enquadramento manual de fotos com prévia; galeria só com carrossel
- [x] QR Code de convite de uso único
- [x] Convite vinculado a um convidado da lista → confirmação simples só dele
- [x] Senha padrão do casamento definida pelos noivos (convidado não cria senha)

## Pedido 04/10 (2)
- [x] Dependentes com nome por convidado (planilha + edição), só ele confirma os dele
- [x] Presença sem busca: só pelo convite individual
- [x] Passo a passo didático da presença na aba "Convidados" (4 etapas + dica), textos de convite e importação mais claros

## Pedido 04/10 — prévia fiel das fotos
- [x] Prévia no envio para capa (celular/computador) e carrossel, antes de confirmar a foto
- [x] Carrossel preserva a foto inteira; capa simula o modo e a posição configurados
- [x] Upload real de recorte vertical validado no painel e na galeria pública; prévia móvel sem transbordamento e sem erros de execução. Fotos temporárias removidas; build automático OK.

## Pedido 08/10
- [x] Ocultar presentes esgotados e manter Presentes/Presença fixos no cabeçalho (375px e 1280px verificados)
- [x] Preservar fotos inteiras no computador e alinhar prévia
- [x] Tela de sucesso após presença e cadastro de múltiplos dependentes (regra de nomes testada; confirmação autenticada não exercitada)

## Pedido 14/10
- [x] Editar nome do convidado direto na lista (botão de lápis, sem apagar)
- [x] Nomes repetidos permitidos (índice único de nome removido; CPF continua único)

- Unificadas as abas "Convidados" e "Convites" da área dos noivos em uma só ("Convidados"): lista, perfis criados, gerador de links/QR Code e co-proprietários.

## Pedido 14/10
- [x] Aba Presentes: 15 modelos prontos com brincadeiras/trocadilhos (GiftPresets.tsx), um clique adiciona a lista; tsgo limpo

## Pedido 24/10
- [x] Primeiro login do convidado: exigir só um entre telefone, CPF ou e-mail

- [ ] Login dando "failed to fetch" (01/11) — investigar

## Revisão de segurança e operação — 13/11
- [x] Conferir a avaliação contra o código e as permissões atuais: exposição de campos internos, presença sem vínculo, recibo com leitura direta, idempotência aleatória e fallback financeiro confirmados.
- [ ] P0: separar dados públicos e privados; fechar confirmação/busca e vinculação de convidados; recibo público sem dados pessoais; idempotência por pedido e reutilização de Pix.
- [ ] P1: presentes ilimitados configuráveis, mantendo cotas limitadas; exigir MP conectado; operações financeiras somente no servidor; rotação coordenada do segredo; criptografia de tokens; assinatura e valor do webhook.
- [ ] Alinhar quem paga as taxas entre banco, cadastro, termos e PDF, preservando faixas e decisões existentes até confirmação.
- [ ] P2: documentação de publicação, proteção de arquivos de ambiente, testes de pedidos, expiração segura de pendências, monitoramento e retenção de dados.
- [ ] P3: checklist de lançamento, organização do painel, aprovação e alertas de operação; validar com casais.
- [ ] Verificar backup/exportação atual antes de mudanças sensíveis — inventário disponível apenas na interface de Backups.
- [x] Presença: RPC exige conta e vínculo, busca pública revogada, vínculo antigo por CPF bloqueado; busca removida da página. Permissões verificadas no banco e tela sem login verificada sem campos de pesquisa.
- [x] Recibo: consulta mínima por código e casamento, sem dados pessoais; tela não afirma pagamento antes da confirmação. Tela de pedido inexistente verificada sem login; ainda não há pedido pago de visitante disponível para testar recibo real.
- [x] Pix/cartão: chave estável por order.id; Pix pendente reaproveitado. Testes de regras aprovados; concorrência real no provedor não exercitada.
- [x] Modelos de brincadeira usam quantidade ilimitada (zero), banco permite explicitamente; presentes existentes e cotas mantêm limites. Regra testada.
- [x] Webhook: conferência de valor, moeda BRL e casamento antes de confirmar. Assinatura do provedor ainda depende de configurar seu segredo.
- [x] Comando de testes e documentação corrigidos: seis testes aprovados, prévia sem erros. Target Vercel externo não verificado.
- [ ] Bloqueadores: confirmar exportação recente para separação dos dados; coordenar segredos e publicação Vercel; definir pagador de taxas e prazos LGPD; configuração de monitoramento/assinatura; validação com conta convidada e casais.
- [ ] Arquivos de ambiente: proteção é gerenciada pela plataforma, edição do arquivo de exclusões recusada; responsável pelo repositório deve revisar rastreamento/histórico sem publicar credenciais.
- [x] Validação autenticada: conta do solicitante sem convite vinculado recebeu aviso de bloqueio e nenhum botão para enviar resposta; verificado na prévia. Fluxo positivo com convidado vinculado ainda precisa de conta/convite de teste, sem consumir convites reais.
- [ ] Próxima etapa aguardando confirmação de exportação recente; pagador já confirmado como convidado. Dados internos ainda não separados e operações financeiras ainda não revogadas, para não interromper a instalação Vercel sem coordenação.
- [x] Pagador confirmado: convidado. Padrão do banco alterado para guest e configurações existentes alinhadas sem recalcular pedidos antigos; termos atualizados. Lista aguarda o preço calculado antes de mostrar valor ou habilitar compra, evitando piscar o preço sem comissão.
- [ ] Cópia de segurança explicada: exportar os dados atuais na área Database → Manage → Settings → Export project data; não inclui fotos. Confirmação ainda pendente antes da separação de dados privados.

## Entrega 16/11 — projeto e resumo
- [x] Conferir o andamento e executar os testes: seis aprovados, 16 verificações.
- [x] Preparar entrega do ZIP do código atual e resumo de alterações, funcionamento, validações e pendências; arquivos inspecionados sem segredos, dependências, metadados ou saídas de compilação. O ZIP não substitui a cópia dos dados e fotos do casamento.

## Continuação 17/11 — concluir antes de nova entrega
- [x] Criar projeção pública explícita e cópia privada sincronizada; bloquear leitura das colunas antigas para visitantes e contas sem gestão. Validar permissões e telas antes de considerar toda a etapa P0 concluída.
- [ ] Completar preço final no detalhe e carrinho e impedir cobrança sem conta de recebimento conectada.
- [ ] Concluir as demais pendências financeiras, operacionais e de painel listadas acima; registrar bloqueadores externos sem declarar conclusão total.
- [ ] Gerar novo ZIP e resumo somente depois da conclusão e validação.
- [ ] Vercel confirmada ativa: coordenar atualização do código antes da troca de segredos; código antigo pode deixar de ler casamentos ou executar operações financeiras após as novas restrições. Não reabrir permissões inseguras para manter versões antigas.
- [x] Pedido 22/11: restaurar acesso ao link do casamento para visitantes sem login e convidados comuns, sem expor novamente dados internos; versão Vercel publicada e verificada.
- Endereço afetado confirmado: https://wedding-gift-hub.vercel.app/casamento/pedro-e-beatriz; comparar a versão externa sem transferir sessões ou credenciais para essa origem.
- [x] Diagnóstico 22/11: Vercel mostrou “Site não encontrado” e consultou weddings; o código atual consulta wedding_public. Na versão atual, visitante sem login e conta de teste com papel guest abriram o casamento em 390px e 1280px, sem acesso aos campos privados.
- [x] Restaurar o endereço Vercel: correção enviada ao GitHub e publicação concluída; acesso público e convidado confirmado sem reabrir a leitura de weddings.
- [x] Pedido 22/11 às 04:15 UTC: repetir teste do endereço Vercel sem login; ainda mostra “Site não encontrado” e consulta weddings. A versão corrigida abre Pedro & Beatriz usando wedding_public.
- [x] Implantar correção de acesso na Vercel e validar visitantes e convidados: concluído pelo GitHub autorizado; verificação no endereço publicado em celular e computador.
- [x] Repositório Vercel identificado pelo usuário: vhramoss/wedding-gift-hub, branch master; conexão GitHub autorizada nesta conversa e permissão de escrita verificada. A última versão ainda lê weddings publicamente.
- [x] Enviar correção das leituras públicas pelo GitHub e acompanhar a publicação automática; testar o endereço publicado sem login e com conta convidada de teste, sem usar contas ou convites reais.
- [x] Autorização 22/11 às 04:20 UTC: atualizar vhramoss/wedding-gift-hub para restaurar o acesso na Vercel. Commit 849d64cc42047b2a9038e7d0c0fef1696c1bf717 aplicado em master sem reescrever histórico; correção restrita às leituras públicas e tipos compatíveis, preservando configuração e demais arquivos da instalação externa.
- [x] Vercel confirmou publicação concluída às 04:23:20 UTC. Link https://wedding-gift-hub.vercel.app/casamento/pedro-e-beatriz abriu para visitante e conta temporária com papel guest, em 1280px e 390px; sessão autenticada confirmada na consulta wedding_public. Capturas mostram casamento e botão Sair para convidado. Sete testes locais aprovados; essa publicação não inclui todas as outras pendências da revisão financeira e operacional.
