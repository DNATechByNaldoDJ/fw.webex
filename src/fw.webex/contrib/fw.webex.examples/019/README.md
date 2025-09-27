# 💡 Exemplo de uso (19)

<img width="1342" height="679" alt="image" src="https://github.com/user-attachments/assets/dc10e953-18b3-4e18-b9c7-54eb1f2eb41b" />

<img width="1359" height="700" alt="image" src="https://github.com/user-attachments/assets/f47075a7-8aac-44fa-9ac2-a4ae78ae6a0a" />

---

# FWWebEx - Mini Framework para Desenvolvimento Web no TOTVS Protheus

Bem-vindo ao repositório `fw.webex`, um mini framework projetado para simplificar o desenvolvimento de páginas web no sistema ERP TOTVS Microsiga Protheus. O FWWebEx permite criar interfaces web utilizando apenas AdvPL/TLPP, sem a necessidade de conhecimentos prévios em PO-UI, Angular ou outras tecnologias web. Este projeto é ideal para desenvolvedores Protheus que desejam criar páginas web de forma prática e acessível.

## Sobre o Projeto

O `fw.webex` é um conjunto de ferramentas e exemplos que facilita a criação de interfaces web no ambiente Protheus, aproveitando o suporte nativo à web introduzido pelo framework PO-UI. O objetivo é abstrair as complexidades do PO-UI e de tecnologias como Angular, permitindo que desenvolvedores utilizem AdvPL/TLPP para criar páginas funcionais e visualmente atrativas.

O script `html2fwwebex.py` é uma ferramenta utilitária que converte páginas HTML (como as baseadas em templates Bootstrap, por exemplo, SBAdmin) em código TLPP compatível com o Protheus. O exemplo `fw.webex.example.019.tlpp` demonstra essa conversão, mas a visão futura do projeto é criar componentes nativos no FWWebEx que gerem resultados semelhantes de forma mais amigável, sem depender de conversões manuais.

## Estrutura do Repositório

- **`/py`**: Contém scripts Python, como `html2fwwebex.py`, usados para conversão de HTML para TLPP.
- **`/src/fw.webex.examples`**: Diretório com exemplos práticos, incluindo o `fw.webex.example.019.tlpp`, que mostra a conversão de uma página Bootstrap para TLPP.
- **`/README.md`**: Este arquivo, com informações sobre o projeto e instruções de uso.

## Exemplo: fw.webex.example.019.tlpp

O arquivo `fw.webex.example.019.tlpp`, localizado em `/src/fw.webex.examples/019`, é um exemplo prático que demonstra como uma página web baseada no template SBAdmin (Bootstrap) pode ser convertida para TLPP usando o script `html2fwwebex.py`. Este exemplo foi gerado com 99,9% de automação, mostrando como o FWWebEx pode transformar HTML em código executável no ambiente Protheus.

### Como Usar o Exemplo

1. **Pré-requisitos**:
   - Ambiente TOTVS Microsiga Protheus configurado com suporte a web (PO-UI habilitado).
   - Python 3.8 ou superior instalado (para usar o `html2fwwebex.py`).
   - Conhecimento básico de AdvPL/TLPP.

2. **Configuração**:
   - Clone este repositório:
     ```bash
     git clone https://github.com/DNATechByNaldoDJ/fw.webex.git
     cd fw.webex
     ```
   - Instale as dependências Python, se necessário:
     ```bash
     pip install -r py/requirements.txt
     ```

3. **Executando o Exemplo**:
   - Navegue até o diretório do exemplo:
     ```bash
     cd src/fw.webex.examples/019
     ```
   - Copie o arquivo `fw.webex.example.019.tlpp` para o ambiente Protheus.
   - Compile e execute o código TLPP no Protheus para visualizar a página web gerada.

4. **Funcionalidades do Exemplo**:
   - Demonstra uma página web funcional no Protheus, baseada no template SBAdmin do Bootstrap.
   - Mostra como o script `html2fwwebex.py` converte HTML em TLPP, mantendo a estrutura visual e funcional.
   - Serve como base para futuros componentes nativos do FWWebEx.

## Ferramenta: html2fwwebex.py

O script `html2fwwebex.py`, localizado no diretório `/py`, converte páginas HTML em código TLPP compatível com o Protheus. Ele é especialmente útil para desenvolvedores que desejam adaptar templates web existentes (como Bootstrap) para o ambiente Protheus sem reescrever o código manualmente.

### Como Usar o html2fwwebex.py

1. **Pré-requisitos**:
   - Python 3.8 ou superior.
   - Um arquivo HTML válido (por exemplo, um template do SBAdmin).
   - Ambiente Protheus configurado para testes.

2. **Execução**:
   - Execute o script fornecendo um arquivo HTML como entrada:
     ```bash
     python py/html2fwwebex.py caminho/para/arquivo.html
     ```
   - O script gerará um arquivo TLPP que pode ser compilado no Protheus.

3. **Exemplo de Uso**:
   ```bash
   python py/html2fwwebex.py exemplo_sbadmin.html
   ```
   O resultado será um arquivo TLPP que, quando executado no Protheus, renderiza a página web correspondente.

## Visão Futura

Embora o exemplo `fw.webex.example.019.tlpp` dependa da conversão de HTML para TLPP, o objetivo final do FWWebEx é criar componentes nativos que eliminem a necessidade de conversões manuais. Esses componentes permitirão que desenvolvedores criem interfaces web diretamente em AdvPL/TLPP, com uma API simples e amigável, mantendo a compatibilidade com o Protheus e sem exigir conhecimento em PO-UI ou outras tecnologias web.

## Requisitos

- **TOTVS Protheus**: Versão com suporte ao framework PO-UI.
- **Python**: Versão 3.8 ou superior (para usar o `html2fwwebex.py`).
- **Conhecimento Básico**: AdvPL/TLPP para desenvolvimento e execução dos exemplos.
- **Dependências Python**: Listadas em `requirements.txt`, se aplicável.

## Como Contribuir

1. Faça um fork do repositório.
2. Crie uma branch para suas alterações:
   ```bash
   git checkout -b minha-nova-funcionalidade
   ```
3. Commit suas alterações:
   ```bash
   git commit -m "Adiciona nova funcionalidade"
   ```
4. Envie para o repositório remoto:
   ```bash
   git push origin minha-nova-funcionalidade
   ```
5. Abra um Pull Request no GitHub.

## Recursos Adicionais

- [Documentação TOTVS Protheus](https://tdn.totvs.com/): Documentação oficial do Protheus.
- [PO-UI](https://po-ui.io/): Framework web oficial do Protheus.
- [SBAdmin](https://startbootstrap.com/theme/sb-admin): Template Bootstrap usado no exemplo.

## Licença

Este projeto é licenciado sob a [MIT License](LICENSE). Consulte o arquivo LICENSE para mais detalhes.
