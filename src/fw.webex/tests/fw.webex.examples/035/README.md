# Exemplo 035 — tabelas offline no navegador local

Variação do exemplo 001. Execute `u_FWWebExExample_035()` ou use
**FWWebEx → Tables** no exemplo 000.

Este exemplo usa uma exceção didática: consulta a SX5 durante a exportação e
copia os dados para a máquina do usuário. O navegador não consulta o Protheus.
O exemplo 036 mantém a consulta ao servidor após a exibição, via TWebChannel.

## Fluxo

1. Monta o HTML com títulos, espaços de resultado e carregadores SVG.
2. Consulta SX5 32 e 35, excluindo registros deletados, e prepara o arquivo de dados.
3. Grava os arquivos no AppServer e os copia com `WebFileTools():CopyFile`
   para `GetTempPath()` no cliente.
4. Abre o caminho local do HTML com `ShellExecute`.
5. Depois de `DOMContentLoaded` e dois frames, JavaScript carrega o arquivo
   local de dados e monta cabeçalho, linhas, seleção e exclusão demonstrativa.

Cada execução gera dois nomes únicos na pasta temporária local:

- `fwwebex-offline-<UUID>.html` — página, estilos, SVG e scripts embutidos;
- `fwwebex-offline-<UUID>.data.js` — cópia dos dados das duas tabelas.

Os dois arquivos ficam disponíveis após encerrar o exemplo. Para reabrir sem
conexão, abra o HTML; se mover os arquivos, mantenha ambos na mesma pasta.
Podem ser apagados manualmente quando a cópia não for mais necessária.
Não há dependências de CDN, REST, TWebChannel ou WebApp durante a consulta
offline. WebAgent/SmartClient e acesso ao banco são necessários para exportar.

O arquivo de dados contém JSON atribuído a uma variável JavaScript. A leitura
usa um script clássico local, evitando as restrições de `fetch()` em `file://`.
Os valores das células são inseridos com `textContent`, sem interpretação de HTML.

**Recarregar copia local** reconstrói a tabela com os dados exportados;
não atualiza a SX5 nem persiste exclusões. Para obter dados atuais, execute o
exemplo novamente. A página informa data/hora da exportação.

## Compilação

Além dos fontes usuais do FWWebEx e de `FWExampleTools`, compile:

- `contrib/fw.webex.features/features/fw.webex.feature.fwloader.tlpp`;
- `tests/fw.webex.examples/000/fw.webex.example.async.tables.tlpp`;
- `tests/fw.webex.examples/035/fw.webex.example.035.tlpp`;
- o exemplo 000 atualizado, para incluir as novas entradas no menu.

O carregador usa FW menor, WebEx abaixo (Web branco e Ex turquesa) e um traço
que percorre o hexágono. Respeita redução de movimento e não impõe atraso
artificial: uma carga local rápida pode mostrar a animação por pouco tempo.
O SVG é embutido; não precisa compilar um recurso para executar o exemplo.

## Verificação

1. Exportar no Protheus e confirmar que a barra de endereço mostra um arquivo local.
2. Conferir os resultados com o exemplo 001, inclusive uma tabela sem registros.
3. Fechar o Protheus, desconectar a rede e reabrir o HTML salvo.
4. Selecionar/excluir uma linha e recarregar: a linha reaparece da cópia local.
5. Renomear temporariamente o `.data.js` e reabrir o HTML: conferir mensagem
   de arquivo ausente. Restaurar o nome e tentar novamente.
6. Ativar redução de movimento: o SVG fica estático.

```powershell
node --test src/fw.webex/contrib/fw.webex.features/tests/fwloader-async-tables.test.mjs
node src/fw.webex/contrib/fw.webex.features/tests/fwloader-preview.mjs --offline
```

O segundo comando gera uma prévia com o HTML/scripts reais e dados simulados
na pasta temporária do sistema. Os testes Node não substituem compilação TLPP
e execução real em Protheus.
