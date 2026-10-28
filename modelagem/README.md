# Modelagem Lógica Multiparadigma (TADS 2019 - UFRN)

Este diretório contém a modelagem lógica da estrutura curricular do curso de **Tecnologia em Análise e Desenvolvimento de Sistemas (TADS 2019)** da UFRN, implementada e documentada sob três paradigmas de bancos de dados:

---

## Estrutura das Pastas dos Modelos

### 📁 [1_relacional/](1_relacional/) — Abordagem Relacional (SQL / 3FN)
* **SGBD Físico:** PostgreSQL 16
* **Tabelas Principais:** `CURSO`, `ESTRUTURA_CURRICULAR`, `DISCIPLINA`, `MATRIZ_COMPONENTE`, `PRE_REQUISITO`.
* **Destaque Técnico:** Normalização rigorosa em 3ª Forma Normal (3FN), integridade referencial forte e resolução de dependências recursivas via Common Table Expressions (`WITH RECURSIVE`).
* **Arquivos:**
  * [README.md](1_relacional/README.md) — Documentação conceitual completa.
  * [diagrama_relacional.mmd](1_relacional/diagrama_relacional.mmd) — Diagrama Entidade-Relacionamento em Mermaid.
  * [visualizar_diagrama.html](1_relacional/visualizar_diagrama.html) — Visualizador interativo em navegador.
  * [consultas_exemplos.sql](1_relacional/consultas_exemplos.sql) — Queries SQL de grade e recursão.

---

### 📁 [2_documentos/](2_documentos/) — Abordagem Não Relacional em Documentos
* **SGBD Físico:** MongoDB 7.0 Community Edition
* **Coleções:** `cursos` (visão agregada da grade com períodos embutidos) e `disciplinas` (catálogo mestre com array de pré-requisitos).
* **Destaque Técnico:** Otimização para leitura (*Read Optimization*), entrega da grade inteira em 1 única leitura atômica e travessia de dependências via estágio `$graphLookup` no Aggregation Pipeline.
* **Arquivos:**
  * [README.md](2_documentos/README.md) — Documentação conceitual completa.
  * [diagrama_documentos.mmd](2_documentos/diagrama_documentos.mmd) — Diagrama de Classes BSON em Mermaid.
  * [visualizar_diagrama.html](2_documentos/visualizar_diagrama.html) — Visualizador interativo em navegador.
  * [schema_colecoes.json](2_documentos/schema_colecoes.json) — Esquema de validação JSON Schema.
  * [consultas_exemplos.js](2_documentos/consultas_exemplos.js) — Scripts de consulta e agregação.

---

### 📁 [3_grafo/](3_grafo/) — Abordagem Não Relacional em Grafos
* **SGBD Físico:** Neo4j 5 Community Edition
* **Modelo:** Grafo Rotulado com Propriedades (*Labeled Property Graph - LPG*)
* **Nós e Arestas:** Nós `:Curso`, `:Estrutura`, `:Disciplina` conectados por arestas `[:POSSUI_ESTRUTURA]`, `[:CONTEM]` e `[:EXIGE_PRE_REQUISITO {tipo: 'E'|'OU'}]`.
* **Destaque Técnico:** *Index-Free Adjacency* com custo de travessia $O(1)$ por salto e travessia transitiva de pré-requisitos expressa em 3 linhas de OpenCypher (`[:EXIGE_PRE_REQUISITO*1..]`).
* **Arquivos:**
  * [README.md](3_grafo/README.md) — Documentação conceitual completa.
  * [diagrama_grafo.mmd](3_grafo/diagrama_grafo.mmd) — Diagrama topológico do grafo em Mermaid.
  * [visualizar_diagrama.html](3_grafo/visualizar_diagrama.html) — Visualizador interativo em navegador.
  * [schema_grafo.cypher](3_grafo/schema_grafo.cypher) — Constraints e índices em Cypher.
  * [consultas_exemplos.cypher](3_grafo/consultas_exemplos.cypher) — Consultas Cypher de caminhos e dependências.

---

### 🌐 [visualizador_completo.html](visualizador_completo.html)
Dashboard unificado em HTML com abas para alternar instantaneamente entre os 3 diagramas em tela cheia durante a apresentação em vídeo.

