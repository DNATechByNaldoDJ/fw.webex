# Exemplo 036 — tabelas carregadas no TWebEngine

Versão assíncrona do exemplo 002. Execute `u_FWWebExExample_036()` ou use
**FWWebEx → Tables** no exemplo 000.

Apresenta a página integrada no Protheus por `FWExampleTools():HtmlFileShow`
e `TWebEngine`. Compartilha consultas, carregador SVG e renderização das
tabelas com o [exemplo 035](../035/README.md), que exporta uma cópia offline.
No 036, os dados são consultados ao vivo via TWebChannel após a exibição.

Compile os fontes compartilhados indicados no exemplo 035 e
`fw.webex.example.036.tlpp`. A janela permanece dentro de
`FWExampleTools():Execute`, mantendo empresa/filial disponíveis até o fim das
consultas. O callback anterior do canal é restaurado ao fechar a janela.

A página inicial não contém linhas nem estrutura de tabela. JavaScript aguarda
a primeira pintura, solicita SX5 32/35, recebe JSON e cria cabeçalho, linhas e
ações. O traço turquesa percorre o hexágono ao redor do FW durante a espera.
Cada tabela oferece mensagem de erro, timeout e nova tentativa independentes.

Execute a suíte Node indicada no exemplo 035. No Protheus, compare os resultados
com o exemplo 002, confira recarregar/selecionar/excluir, uma tabela vazia,
falha de consulta, timeout e fechar/reabrir o TWebEngine. Os identificadores
de solicitação impedem que uma resposta antiga substitua uma nova tentativa.
Timeout de 30 segundos no navegador não cancela SQL já iniciado no servidor.
Enquanto uma atualização está pendente, o resultado anterior permanece visível.
