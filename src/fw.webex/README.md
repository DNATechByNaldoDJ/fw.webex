#  💡 Criando Componentes Personalizados no FWWebEx: Simples e Poderoso! 🚀

O [FWWebEx](https://github.com/DNATechByNaldoDJ/fw.webex/) é um framework leve e flexível para construir aplicações web em AdvPL, permitindo criar elementos UI como modais, gráficos e tabelas com pouquíssimo esforço. Ele usa uma sintaxe intuitiva baseada em blocos WITH WEBEXOBJECT, o que torna o desenvolvimento ágil e legível.

### Exemplo: [Implementando um Painel de Filtro para DataTable](https://github.com/DNATechByNaldoDJ/fw.webex/blob/main/src/fw.webex/web/component/fw.webex.datatable.filter.panel.tlpp)

Aqui está o código principal da classe `WebExDataTableFilterPanel` (extraído de `fw.webex.datatable.filter.panel.tlpp`). Veja como é direto construir um modal com header, body, footer e scripts integrados:

```xBase
class WebExDataTableFilterPanel from WebExControl

    // Propriedades protegidas
    protected data cTitle as character
    protected data cTargetTableID as character
    protected data jTargetTableFields as json

    // Construtor
    public method New(cTitle as character, cTargetTableID as character, jTargetTableFields as json) as object

endclass

method New(cTitle, cTargetTableID, jTargetTableFields) class WebExDataTableFilterPanel

    // Inicialização
    ::cTitle := cTitle
    ::cTargetTableID := cTargetTableID
    ::jTargetTableFields := jTargetTableFields

    _Super:New("div")

    WITH WEBEXOBJECT ::oPanel
        // Configura o modal Bootstrap
        .:AddClass("modal fade")
        WITH WEBEXOBJECT ::oPanelContainer CLASS WebExDiv
            .:AddClass("modal-dialog modal-lg")
            WITH WEBEXOBJECT ::oPanelContent CLASS WebExDiv
                .:AddClass("modal-content")
                // Header com título e botão close
                WITH WEBEXOBJECT ::oPanelHeader CLASS WebExDiv
                    .:AddClass("modal-header")
                    // ... (título e botão close)
                END WEBEXOBJECT
                // Body com container para filtros dinâmicos
                WITH WEBEXOBJECT ::oPanelBody CLASS WebExDiv
                    .:AddClass("modal-body")
                    // ... (botão para adicionar filtro e script JS para rows dinâmicas)
                END WEBEXOBJECT
                // Footer com botões Close e Apply
                WITH WEBEXOBJECT ::oPanelFooter CLASS WebExDiv
                    .:AddClass("modal-footer")
                    // ... (botões e script JS para aplicar filtros)
                END WEBEXOBJECT
            END WEBEXOBJECT
        END WEBEXOBJECT
    END WEBEXOBJECT

return(self)
```

### Por Que é Tão Fácil?
- **Estrutura em Blocos**: Os blocos `WITH WEBEXOBJECT` aninham elementos HTML de forma hierárquica, como um DOM virtual em AdvPL.
- **Integração Nativa**: Suporte a Bootstrap, DataTables e scripts JS embutidos – adicione classes, atributos e conteúdos com métodos simples como `.:AddClass()` ou `.:SetContent()`.
- **Reusabilidade**: Crie uma vez e use em múltiplas telas. No exemplo `[fw.webex.example.020.tlpp](https://github.com/DNATechByNaldoDJ/fw.webex/blob/main/src/fw.webex.examples/020/fw.webex.example.020.tlpp)`, vemos esse painel sendo integrado a um dashboard com DataTables server-side.
- **Extensibilidade**: Herda de `WebExControl` (de `fw.webex.control.tlpp`), que cuida de IDs, atributos e renderização automática.

Com [FWWebEx](https://github.com/DNATechByNaldoDJ/fw.webex/), você transforma ideias em componentes funcionais em minutos, sem reinventar a roda. Ideal para dashboards, relatórios e apps web no Protheus!

---

#FWWebEx #DesenvolvimentoTotvs #WebDevelopment #UIComponents #AdvPLProgramming

---
