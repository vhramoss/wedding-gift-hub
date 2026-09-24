# Corrigir pedidos, prévia e tipografia

## Resultado
- Reformatar a aba **Pedidos** para mostrar somente dados válidos, com nome, presente, pagamento, valor e data legíveis no celular e no computador.
- Fazer a prévia de **Aparência** reproduzir a capa real: título personalizado, foto, enquadramento, opacidade, altura, cor e informações principais.
- Aplicar a fonte escolhida somente na capa e nos títulos do site; textos, menus, botões e dados permanecem em uma fonte simples e legível.

## Implementação
- Normalizar valores e datas dos pedidos antigos e atuais, com alternativas seguras para campos ausentes e sem exibir `NaN`, `undefined` ou `Invalid Date`.
- Reutilizar os mesmos dados e regras visuais da capa pública na prévia de Aparência, sem duplicar configurações conflitantes.
- Separar a variável de fonte decorativa da fonte de leitura; remover a escolha de fonte dos textos da tela de Aparência.
- Ajustar a disposição dos pedidos para telas pequenas e registrar a etapa no roadmap.

## Verificação
- Conferir a compilação e os registros de erro.
- Testar no celular a aba Pedidos, a prévia de Aparência e uma página pública do casamento.
