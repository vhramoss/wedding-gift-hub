# Mostrar o preço final nos cards de presentes

## Resultado
- Exibir em cada card o valor do presente já com a comissão aplicável àquele casamento e àquela faixa de preço.
- Usar o mesmo cálculo seguro do pagamento, inclusive para presentes em cotas e no carrinho.
- Manter juros de parcelamento separados, pois dependem da quantidade de parcelas escolhida.

## Implementação
- Disponibilizar ao site público apenas os totais calculados, sem expor as regras internas de comissão.
- Atualizar a lista, o carrinho e a tela de pagamento para consumirem esses totais.
- Validar que o preço do card coincide com Pix/débito e que qualquer acréscimo do crédito aparece claramente antes do pagamento.
