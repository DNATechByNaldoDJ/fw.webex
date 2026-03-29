# 📜 🧩 WebExAsciiLoader — DSL de Animação

## 🎬 📊 Tabela de Comandos

| Comando     | Sintaxe       | Tipo     | Descrição                              | Exemplo        |
| ----------- | ------------- | -------- | -------------------------------------- | -------------- |
| Reset       | `;`           | Controle | Limpa a área atual (buffer)            | `;`            |
| Clear total | `;c`          | Controle | Limpa toda renderização (todas áreas)  | `;c`           |
| Delay       | `;d=ms`       | Tempo    | Define delay do frame/linhas           | `;d=100`       |
| Cor         | `;color=cor`  | Estilo   | Altera cor do texto                    | `;color=red`   |
| Progresso   | `;progress=n` | Info     | Exibe progresso (%)                    | `;progress=45` |
| Área        | `;area=nome`  | Layout   | Define área de renderização            | `;area=top`    |
| Digitação   | `;type`       | Efeito   | Efeito digitando próxima linha         | `;type`        |
| Loop        | `;loop=n`     | Controle | Repete bloco de linhas                 | `;loop=3`      |
| Repetição   | `;repeat=n`   | Controle | Repete uma sequencia inteira n vezes   | `;repeat=3`    |
| Repetição   | `;repeat=inf` | Controle | Repete uma sequencia inteira inf. vezes| `;repeat=inf`  |

---

# 🧱 📐 Áreas de Renderização

| Área     | Descrição               |
| -------- | ----------------------- |
| `full`   | Área padrão             |
| `top`    | Parte superior (header) |
| `bottom` | Rodapé                  |

---

# 🎨 🎯 Cores suportadas (CSS)

| Nome           | Valor     |
| -------------- | --------- |
| Verde terminal | `#00ff88` |
| Vermelho       | `red`     |
| Amarelo        | `#ffaa00` |
| Azul           | `cyan`    |
| Branco         | `white`   |

👉 aceita qualquer CSS válido

---

# ⏱️ ⏳ Comportamento de Tempo

| Configuração | Efeito                                     |
| ------------ | ------------------------------------------ |
| `;d=100`     | Delay base do frame                        |
| linha normal | delay/2                                    |
| `;type`      | delay por caractere (fixo ou customizável) |

---

# 🔁 🔄 Loop

| Sintaxe   | Comportamento            |
| --------- | ------------------------ |
| `;loop=3` | Repete bloco seguinte 3x |
| bloco     | até próximo comando      |

---

# ⌨️ ✍️ Digitação (`;type`)

| Regra         | Descrição            |
| ------------- | -------------------- |
| `;type`       | ativa modo digitando |
| próxima linha | será digitada        |
| velocidade    | baseada no delay     |

---

# 📡 🔌 WebSocket (integração)

| Método            | Uso                |
| ----------------- | ------------------ |
| `loader_ws(url)`  | conecta WS         |
| evento `progress` | atualiza progresso |

### Exemplo JSON WS

```json id="k2gkzw"
{ "type": "progress", "value": 75 }
```

---

# 🧠 🧬 Fluxo de Execução

Ordem de interpretação:

1. Frame
2. Linha
3. Comando (`;`)
4. Atualiza estado
5. Renderiza
6. Delay

---

# 💥 🧪 Exemplo completo

```text id="q0q6o7"
;area=top
;color=cyan
FWWebEx Engine

;type
Inicializando sistema...

;loop=2
[>      ]
[>>     ]
[>>>    ]

;area=bottom
;progress=10
;progress=50
;progress=100

;type
Finalizado!
```

---

# ⚠️ ⚙️ Regras importantes

| Regra                         | Explicação          |
| ----------------------------- | ------------------- |
| comandos começam com `;`      | obrigatório         |
| comandos não renderizam       | só controlam        |
| `;type` consome próxima linha | cuidado com ordem   |
| `;loop` consome bloco         | até próximo comando |
| áreas são independentes       | buffers separados   |

---
