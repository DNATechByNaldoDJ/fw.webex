# ✨FWWebEx✨ :: Framework Web Extensível para TOTVS (Microsiga) Protheus :: ADVPL/TLPP 🌟

## ⭐Gostou do projeto? Deixa uma estrelinha(⭐) aí no topo! Isso ajuda muito!

[![Stars](https://img.shields.io/github/stars/DNATechByNaldoDJ/fw.webex?style=social)](https://github.com/DNATechByNaldoDJ/fw.webex)
![Clones](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/DNATechByNaldoDJ/fw.webex/main/clone-badge.json)

![fwwebex_banner](https://github.com/user-attachments/assets/64a542a9-97f3-47b0-81f9-1655374a1a90)

--
**FWWebEx** é um microframework escrito em ADVPL/TLPP que permite criar interfaces web responsivas, modernas e funcionais **diretamente do seu código TOTVS (Microsiga) Protheus**, sem precisar de Angular, React ou qualquer outra parafernália.

> **Do TOTVS (Microsiga) Protheus para o browser. Simples. Direto. Web.**

---

## 🚀 Por que FWWebEX?

A TOTVS está indo para o web. Mas o desenvolvedor ADVPL n&atilde;o precisa (re)aprender Angular ou TypeScript só pra fazer uma tela de cadastro ou uma tabela com ação.

**FWWebEx** nasceu da ideia de manter o espírito do desenvolvimento no TOTVS (Microsiga) Protheus:

- Rápido
- Sem burocracia
- Produtivo

Só que agora... **na web.**

---

## ⚙️ O que ele faz?

- Gera páginas HTML com sintaxe 100% TLPP
- Usa **Bootstrap** para comportamento (modais, tabelas, botões)
- Pode usar **PO UI (opcional)** para identidade visual padrão TOTVS
- Tem componentes já prontos como:
  - `fw.webex.page`
  - `fw.webex.control`
  - `fw.webex.table` (com checkbox, modal de exclusão, etc.)
- Permite encadeamento estilo `WITH OBJECT ... END`, via `WithObject()/EndWith()`

---

## 💡 Exemplo de uso (1)

```advpl
#include "fw.webex.th"

using namespace FWWebEx

procedure u_FWWebExExample_001()
    local bExecute as codeblock
    local cHTMLFile as character
    local cProcName:=ProcName() as character
    bExecute:={||FWMsgRun(nil,{||cHTMLFile:=FWWebExExample_001()},"Aguarde",cProcName)}
    FWExampleTools():Execute(bExecute,cProcName,.T.)
    if (!Empty(cHTMLFile).and.File(cHTMLFile))
        ShellExecute("open",cHTMLFile,"","",1)
    endif
return

static function FWWebExExample_001() as character

    local cHTML as character
    local cProcName:=ProcName() as character
    local cHTMLFile:=cProcName as character
    local cSX5TableName:=RetSQLName("SX5") as character

    local oFWWebExPage as object

    WITH WEBEXOBJECT oFWWebExPage CLASS WebExPage ARGS cProcName
        WITH WEBEXOBJECT CLASS WebExBody
            WITH WEBEXOBJECT CLASS WebExMain
                WITH WEBEXOBJECT CLASS WebExTemplateBulkActionTable ARGS cProcName+" (Tabela 32)"
                    .:FromSQL("SELECT * FROM "+cSX5TableName+" WHERE X5_TABELA='32' AND D_E_L_E_T_<>'*'")
                END WEBEXOBJECT
                WITH WEBEXOBJECT CLASS WebExHR
                END WEBEXOBJECT
                WITH WEBEXOBJECT CLASS WebExTemplateBulkActionTable ARGS cProcName+" (Tabela 35)"
                    .:FromSQL("SELECT * FROM "+cSX5TableName+" WHERE X5_TABELA='35' AND D_E_L_E_T_<>'*'")
                END WEBEXOBJECT
            END WEBEXOBJECT
        END WEBEXOBJECT
    END WEBEXOBJECT

    WebFileTools():HTMLFromControl(oFWWebExPage,GetTempPath(),@cHTMLFile,@cHTML,.T.)

    WEBEXOBJECT CLEAN

return(cHTMLFile)
````

![image](https://github.com/user-attachments/assets/65c4706b-420e-40c4-a0dc-8b9412cd186f)

---

## 💡 Exemplo de uso (3)

```advpl
#include "fw.webex.th"

using namespace FWWebEx

procedure u_FWWebExExample_003()
    local bExecute as codeblock
    local cHTML as character
    local cHTMLFile as character
    local cProcName:=ProcName() as character
    bExecute:={||FWMsgRun(nil,{||cHTMLFile:=FWWebExExample_003(@cHTML)},"Aguarde",cProcName)}
    FWExampleTools():Execute(bExecute,cProcName,.T.)
    if (!Empty(cHTMLFile).and.File(cHTMLFile))
        FWExampleTools():htmlFileShow(cHTML,cProcName,cHTMLFile)
        fErase(cHTMLFile)
    endif
return

static function FWWebExExample_003(cHTML as character) as character

    local cScript as character
    local cProcName:=ProcName() as character
    local cHTMLFile:=cProcName as character

    local oFWWebExPage as object

    WITH WEBEXOBJECT oFWWebExPage CLASS WebExPage ARGS cProcName
        WITH WEBEXOBJECT CLASS WebExBody
            WITH WEBEXOBJECT CLASS WebExMain
                WITH WEBEXOBJECT CLASS WebExForm ARGS "Consulta CEP"
                    .:SetFormMethod("get")
                    .:SetFormAction("javascript:buscarCEP()")
                    .:AddField("CEP","cep","text","Digite o CEP")
                    .:AddButton(WebExButton():New("Buscar CEP"))
                END WEBEXOBJECT
                WITH WEBEXOBJECT CLASS WebExScript
                    beginContent var cScript

                        function buscarCEP() {

                        const cep = document.querySelector("input[name='cep']").value.trim();
                        const url = `https://viacep.com.br/ws/${cep}/json/`;

                        fetch(url)
                            .then(response => response.json())
                            .then(data => {
                            if (data.erro) {
                                document.getElementById("resultadoCEP").innerHTML = "<div class='alert alert-danger'>CEP n&atilde;o encontrado.</div>";
                            } else {
                                document.getElementById("resultadoCEP").innerHTML = `
                                <div class='card'>
                                    <div class='card-body'>
                                    <h5 class='card-title'>Endere&ccedil;o</h5>
                                    <p class='card-text'>
                                        <strong>CEP:</strong> ${data.cep}<br/>
                                        <strong>Logradouro:</strong> ${data.logradouro} -
                                        <strong>Complemento:</strong> ${data.complemento} -
                                        <strong>Unidade:</strong> ${data.unidade}<br/>
                                        <strong>Bairro:</strong> ${data.bairro} -
                                        <strong>Localidade:</strong> ${data.localidade}<br/>
                                        <strong>UF:</strong> ${data.uf} -
                                        <strong>Estado:</strong> ${data.estado}<br/>
                                        <strong>Regi&atilde;o:</strong> ${data.regiao} -
                                        <strong>IBGE:</strong> ${data.ibge}<br/>
                                        <strong>GIA:</strong> ${data.gia} -
                                        <strong>DDD:</strong> ${data.ddd}<br/>
                                        <strong>SIAFI:</strong> ${data.siafi}<br/>
                                    </p>
                                    </div>
                                </div>
                                `;
                            }
                            })
                            .catch(() => {
                            document.getElementById("resultadoCEP").innerHTML = "<div class='alert alert-danger'>Erro ao consultar o CEP.</div>";
                            });
                        }

                    endContent
                    .:SetContent(cScript)
                END WEBEXOBJECT
                WITH WEBEXOBJECT CLASS WebExControl TYPE div
                    .:SetFixedID("resultadoCEP")
                    .:SetAttr("class","mt-4")
                END WEBEXOBJECT
            END WEBEXOBJECT
        END WEBEXOBJECT
    END WEBEXOBJECT

    WebFileTools():HTMLFromControl(oFWWebExPage,oFWWebExPage:GetFWWebExTmpPath(),@cHTMLFile,@cHTML,.T.)

    WEBEXOBJECT CLEAN

return(cHTMLFile)
````

![WebExForm](https://github.com/user-attachments/assets/fcf7609f-a2be-43b4-b63e-af5aa2718d58)

---

## 🧩 Dependências

- Nenhuma no backend (ADVPL puro)
- Frontend usa:

  - [Bootstrap 5.n](https://getbootstrap.com)
  - (opcional) [PO UI CSS](https://po-ui.io)
  - (quando `WebExFeatureJsPDF` é habilitada) jsPDF 4.2.1
  - (quando `WebExFeaturePDFJS` é habilitada) PDF.js 3.11.174
  - (quando `WebExFeatureExifReader` é habilitada) ExifReader 4.42.0
  - (quando Labels é habilitado) JsBarcode 3.11.6
  - (quando há comunicação JavaScript -> ADVPL) `@totvs/twebchannel-js`
    1.0.3, carregado sob demanda pelo bridge `FWWebEx.TWebChannel`
  - (opcional, para HTML -> PDF) html2canvas 1.4.1 e DOMPurify 3.4.7

As bibliotecas encapsuladas pelas features acima e o TWebChannel usam versões
fixadas nos respectivos fontes. Bootstrap e PO UI seguem os assets e a
configuração da página/tema e não estão abrangidos por essa garantia. O
TWebChannel prioriza a origem configurada e o asset da própria plataforma antes
do CDN. Fallback local, SRI e modo offline estão acompanhados pelo item
`NX-017`.

---

## 🏷️ Labels e PDF

`WebExLabelDesigner` e `WebExLabelGeneratorPanel` são produtos FWWebEx
autocontidos para desenhar, validar, visualizar, baixar e imprimir rótulos. O
`WebExLabelPDFGenerator` permanece disponível para integração headless.
No Designer, o modo Impressão rasteriza o PDF real em canvas com
`WebExFeaturePDFJS` e mantém as caixas editáveis alinhadas ao viewport nas
quatro rotações ortogonais.
Na importação da arte, `WebExFeatureExifReader` lê PNG `pHYs`, EXIF ou JFIF e
permite ajustar automaticamente a página em milímetros sem incorporar regras
de rótulos à biblioteca genérica.

jsPDF é fornecido pela feature genérica `WebExFeatureJsPDF`; contrato, layout,
textos e códigos de barras permanecem no domínio Labels. Consulte:

- [documentação de Labels](src/fw.webex/contrib/fw.webex.labels/README.md);
- [features genéricas jsPDF, PDF.js e ExifReader](src/fw.webex/contrib/fw.webex.features/README.md);
- [exemplo 031 — designer](src/fw.webex/tests/fw.webex.examples/031/README.md);
- [exemplo 032 — gerador](src/fw.webex/tests/fw.webex.examples/032/README.md).

---

## 🧭 Bootstrap do Runtime

A partir da nova geração, o runtime possui inicialização configurável:

```javascript
window.FWWebEx.config = {
    hooks: {
        beforeInit: function(config, state, FWWebEx) {},
        afterInit: function(config, state, FWWebEx) {},
        onError: function(payload, state, FWWebEx) {}
    }
};

FWWebEx.ready(function(state, FWWebEx) {
    // DOM pronto.
});
```

O exemplo `u_FWWebExExample_027()` demonstra `FWWebEx.init(config)`, `FWWebEx.ready(fn)`, hooks e actions declarativas.

---

## 🔌 Comunicação com ADVPL via TWebChannel

O HTML gerado pelo FWWebEx é exibido pelo WebApp em um `iframe`. Mesmo que o
TWebEngine já tenha preparado o TWebChannel no documento pai, objetos
JavaScript não são compartilhados automaticamente com o documento filho.
Por isso, a presença dos scripts no WebApp não garante que
`window.twebchannel` exista dentro da página FWWebEx.

`FWWebEx.TWebChannel` resolve essa fronteira sem copiar o bootstrap privado da
plataforma:

1. reutiliza `window.twebchannel` quando um provider compatível já existe no
   documento atual;
2. caso contrário, carrega somente `twebchannel.js`, sob demanda e uma única
   vez;
3. tenta, nesta ordem, `FWWebEx.config.twebchannel.src`, o asset publicado pelo
   ambiente Protheus e a versão fixada no CDN;
4. serializa `load()`/`connect()` e expõe um `EventTarget` estável para as
   respostas ADVPL.

O FWWebEx não depende nem injeta `totvstec.js` ou `fwprotheus.js`. Eventual uso
desses arquivos é interno ao WebApp/TWebEngine e não constitui a API do
documento FWWebEx.

Para uma instalação sem acesso ao CDN, indique uma cópia confiável do script
antes da primeira conexão:

```javascript
FWWebEx.config = FWWebEx.config || {};
FWWebEx.config.twebchannel = {
    src: '/webapp/meus-assets/twebchannel.js',
    loadTimeout: 5000,
    connectTimeout: 5000
};
```

`loadTimeout` e `connectTimeout` são os budgets internos das operações
compartilhadas de carga e conexão; ambos usam 5 segundos por padrão. Eles são
distintos de `timeout` passado a `load()`, `connect()` ou `send()`, que limita a
espera daquele consumidor. Assim, um consumidor com prazo curto pode expirar
sem cancelar a tentativa compartilhada que ainda atende outros consumidores.

Uso recomendado:

```javascript
FWWebEx.TWebChannel.onAdvplToJs(function (codeType, codeContent) {
    if (codeType !== 'CALLBACK_RESPONSE') {
        return false; // delega a mensagem ao receptor anterior da plataforma
    }
    console.debug('Resposta ADVPL:', codeType, codeContent);
    return true; // declara que este receptor tratou a mensagem
});

FWWebEx.TWebChannel.send('CALLBACK_EXEC', JSON.stringify({ action: 'teste' }))
    .catch(function (error) {
        console.error(error.code, error.message);
    });
```

O retorno do receptor faz parte do contrato: retorne `true` somente quando a
mensagem tiver sido tratada. `false` (ou qualquer valor diferente de `true`)
preserva a delegação ao `advplToJs` que já existia no provider da plataforma.

Para chamadas com resposta, prefira `FWWebEx.RequestHandler`:

```javascript
FWWebEx.RequestHandler.execute({
    requestData: { action: 'teste' },
    execEvent: 'CALLBACK_EXEC',
    callbackEvent: 'CALLBACK_DATA_RESPONSE',
    responseTimeout: 30000,
    onResponse: function (data) {
        console.log(data);
    },
    onError: function (error) {
        console.error(error.code, error.message);
    }
});
```

Requisições que usam o mesmo `callbackEvent` são serializadas para impedir que
uma resposta seja entregue ao consumidor errado; eventos de resposta distintos
podem continuar em paralelo. `responseTimeout` tem padrão de 30 segundos. Ao
receber resposta, falhar ou expirar, o handler remove listener, timer e estado
de espera. A expiração é informada como
`FWWEBEX_TWEBCHANNEL_RESPONSE_TIMEOUT`.

`forceReconnect` é uma recuperação explícita para um canal comprovadamente
obsoleto, e não deve ser usado em toda chamada:

```javascript
FWWebEx.TWebChannel.connect({ timeout: 5000, forceReconnect: true });
```

Sem essa opção, o bridge preserva a conexão existente ou aguarda o transporte
que o preloader da plataforma já estiver estabelecendo.

Para diagnóstico no console do frame FWWebEx:

```javascript
window.twebchannel                         // provider efetivamente visível
FWWebEx.TWebChannel.getState()             // load, conexão e último erro
document.querySelectorAll(
    'script[data-fwwebex-twebchannel]'
)                                          // fontes tentadas/injetadas
```

Os eventos `FWWebEx:twebchannel:ready` e `FWWebEx:twebchannel:error` permitem
instrumentar a conexão. Os códigos de erro distinguem falha de download,
provider incompatível, dependência ausente, falha de conexão e timeout.
O [exemplo 023](src/fw.webex/tests/fw.webex.examples/023/README.md) demonstra o
fluxo completo com `FWWebEx.RequestHandler`.

---

## 🧾 DataTable Form

`WebExDataTableForm` gera formularios de visualizacao/edicao a partir da mesma configuracao de campos usada por `WebExDataTable`.

Fluxo basico:

```advpl
oForm:=WebExDataTableForm():New("Editar usuario",jTableFields,"edit",{"ID"})
oForm:SetFormConfig(jFormConfig)
oForm:SetDataTableID("minha-tabela")
oForm:SetUpdateFunction("MinhaFuncaoJSDeUpdate")
oForm:LoadFromDataTableRow(jRowData)
oForm:BuildFormLayout(2)
cModalHTML:=oForm:RenderHTMLWithModal()
```

Exemplos:
- `u_FWWebExExample_028()` mostra o uso minimo com modal `view`/`edit`.
- `u_FWWebExExample_029()` integra o formulario com uma `WebExDataTable` client-side.

---

## 🔡 ASCII Page Loader

`u_FWWebExExample_030()` demonstra um overlay de carregamento de pagina com `WebExAsciiLoader`, `FWWebEx.ready()` e liberacao gradual do conteudo.

---

## 📦 Como usar

1. Clone o repositório
2. Compile
3. Use

---

## 🤝 Quer contribuir?

Toda ajuda é bem-vinda! A ideia aqui é **evoluir juntos** como comunidade Protheus:

- Criar novos componentes (`fw.webex.form`, `fw.webex.chart`, etc.)
- Melhorar o renderizador
- Adicionar eventos dinâmicos
- Documentar com mais exemplos

---

## 🛠️ Como Participar

Contribuições são bem-vindas! Siga estas diretrizes para garantir a consistência do código:

🧾 Estilo de Codificação

- Indentação: use 4 espaços por nível de indentação.
- Parênteses, chaves, colchetes: sempre com espaçamento correto e estilo claro.
- return: deve sempre iniciar na mesma coluna do nível atual (sem recuo adicional).
- Nomes de métodos e variáveis: utilize nomes descritivos em inglês, com camelCase para métodos e snake_case para variáveis locais se necessário.
- Classes: o nome deve ser prefixado por WebEx e descrever a função do componente (ex: WebExForm, WebExTable, WebExCardKPI).
- Arquivos: devem estar organizados por tipo (ex: forms/, tables/, components/) dentro de src/fw.webex.

🧪 Contribuindo com Novos Exemplos

- Crie uma nova função com nome u_FWWebExExample_XXX() onde XXX é o próximo número disponível.
- Armazene o exemplo em src/fw.webex.examples/.
- Mantenha a mesma estrutura dos exemplos existentes:

Página HTML gerada via TL++.

Uso de objetos WebEx*.

Interface limpa e responsiva.

📎 Convenções de Commit

Utilizamos padrão Harbour: [How to Participate](https://github.com/naldodj/naldodj-harbour-core#how-to-participate)

```text
2025-07-01 HH:MM UTC seu_nome (contexto)
  + src/...      ; Adição
  - src/...      ; Remoção
  * src/...      ; Alteração
  ! src/...      ; Correção
  % src/...      ; Otimização
```

---

## ✨ Visão

> Acreditamos que dá pra evoluir mantendo o que o Protheus tem de melhor: a produtividade.
> FWWebEx é o passo que faltava pra quem quer ir pro web **sem perder a alma ADVPL**.

---

## ⭐ Gostou do projeto? Deixa uma estrelinha(⭐) aí no topo! Isso ajuda muito!

[![Stars](https://img.shields.io/github/stars/DNATechByNaldoDJ/fw.webex?style=social)](https://github.com/DNATechByNaldoDJ/fw.webex)
![Clones](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/DNATechByNaldoDJ/fw.webex/main/clone-badge.json)

---

### ✅ Configuration: `[FWWEBEX_<ENVIRONMENT>]` Section in `appserver.ini`

To enable integration with the FWWebEx REST services, create a section whose
suffix is the exact environment returned by `GetEnvServer()`. For example, when
`GetEnvServer()` returns `PROTHEUS`, use `[FWWEBEX_PROTHEUS]`:

```ini
[FWWEBEX_PROTHEUS]
RestURL=<e.g.:https://localhost:8091/app-root/>
OAuth2URL=<e.g.:https://localhost:8091/rest/tlpp/oauth2/token>
AppRootURI=<e.g.:https://localhost:8091/app-root/>
ClientID=<e.g.:000000>
ClientSecret=<e.g.:admin>
UserName=<e.g.:admin>
Password=<e.g.:admin>
```

⚠️ **Note:** `WebApp():GetAPPRoot()` and the authorization helpers read
`FWWEBEX_` + `GetEnvServer()`, not a generic `[FWWEBEX]` section. If the suffix
does not match, `AppRootURI` and the credentials are read as empty. An empty
`AppRootURI` is normalized to `/`; the TWebChannel bridge therefore still tries
the environment asset at the site root, where it may return 404 before the
bridge proceeds to its remaining configured/CDN sources. `AppRootURI` is
currently a manual setting; its automatic discovery remains a future
improvement.

---

[História do FWWebEx](https://www.youtube.com/embed/kh3CIL0gkoA)

---

## 📄 Licença

[MIT](LICENSE)

---

<img width="1024" height="1024" alt="dna_tech_logo_black_panter" src="https://github.com/user-attachments/assets/9b39a407-31ca-4a86-a1df-f76790e2036a" />
