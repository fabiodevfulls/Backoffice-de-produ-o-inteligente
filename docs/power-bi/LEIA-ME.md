# Teste no Power BI Desktop

Esta integração consulta a produção em modo somente leitura. Ela não cria, altera nem exclui registros.

1. Abra o Power BI Desktop e escolha **Obter dados > Consulta em branco**.
2. Abra **Editor Avançado** e cole o conteúdo de `CONSULTA-POWER-BI.pq`.
3. Quando o Power BI pedir credenciais, escolha **Básico**.
4. Informe o usuário `powerbi` e, como senha, a chave configurada no segredo `POWER_BI_API_KEY` do Worker.
5. Aplique as credenciais ao endereço `https://controle-backoffice-arii.fabiodasilvaa82.workers.dev/`.

## Filtros opcionais

A URL aceita filtros seguros, que podem ser combinados:

- `?type=protocol` para somente protocolos.
- `?type=call` para somente ligações.
- `?startDate=2026-08-01&endDate=2026-08-31` para um intervalo.

Não coloque a chave dentro da consulta. O Power BI deve guardá-la nas credenciais da fonte de dados.
