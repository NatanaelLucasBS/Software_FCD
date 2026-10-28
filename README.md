# PolyGrade — Consulta da Estrutura Curricular TADS 2019 (UFRN)

[![Node.js](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x-339933?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb)](https://www.mongodb.com/)
[![Neo4j](https://img.shields.io/badge/Neo4j-5.x-008CC1?logo=neo4j)](https://neo4j.com/)
[![Docker](https://img.shields.io/badge/Docker-Containers%20Locais-2496ED?logo=docker)](https://www.docker.com/)

> **Projeto Acadêmico de Persistência Poliglota e Engenharia de Dados**  
> **Universidade Federal do Rio Grande do Norte (UFRN)**  
> **Curso Alvo:** Tecnologia em Análise e Desenvolvimento de Sistemas (TADS) — Matriz Curricular Oficial de 2019  
> **Objetivo:** Modelar, implementar e comparar em condições justas de benchmark a estrutura curricular em 3 paradigmas de banco de dados: **Relacional (SQL)**, **Documentos (NoSQL)** e **Grafos (NoSQL)**, disponibilizando uma interface web moderna com filtros, medição de tempo e prova de genericidade.

---

## 📋 Sumário

1. [Visão Geral da Arquitetura](#-visão-geral-da-arquitetura)
2. [Estrutura Limpa do Repositório](#-estrutura-limpa-do-repositório)
3. [Etapa 1: Modelagem Lógica Multiparadigma](#-etapa-1-modelagem-lógica-multiparadigma)
   - [Abordagem Relacional (SQL / 3FN)](#1-abordagem-relacional-sql--3fn)
   - [Abordagem em Documentos (MongoDB)](#2-abordagem-em-documentos-mongodb)
   - [Abordagem em Grafos (Neo4j)](#3-abordagem-em-grafos-neo4j)
4. [Etapa 2: Implementação Física e Controle de Benchmark](#-etapa-2-implementação-física-e-controle-de-benchmark)
   - [Os 3 Bancos de Dados Locais](#os-3-bancos-de-dados-locais)
   - [A Regra de Ouro do Benchmark Local](#a-regra-de-ouro-do-benchmark-local)
   - [Carga e Paridade dos Dados (100% Idênticos)](#carga-e-paridade-dos-dados)
   - [Métricas Reais Obtidas](#métricas-reais-obtidas)
5. [Etapa 3: Sistema Web com UI e Métricas de Resposta](#-etapa-3-sistema-web-com-ui-e-métricas-de-resposta)
   - [Recursos da Interface](#recursos-da-interface)
   - [Telemetria Dupla: Tempo de Banco vs Tempo Total HTTP](#telemetria-dupla)
6. [Etapa 4: Genericidade e Justificativa da Escolha Final](#-etapa-4-genericidade-e-justificativa-da-escolha-final)
   - [Como Cadastrar a Estrutura de Outro Curso Intuitivamente](#como-cadastrar-a-estrutura-de-outro-curso)
   - [Indicação e Justificativa Técnica da Escolha Final](#indicação-e-justificativa-técnica-da-escolha-final)
7. [Etapa 5: Roteiro Oficial para Gravação do Vídeo da Equipe](#-etapa-5-roteiro-oficial-para-gravação-do-vídeo-da-equipe)
8. [Como Executar o Projeto em 2 Passos](#-como-executar-o-projeto-em-2-passos)

---

## 🏛 Visão Geral da Arquitetura

O sistema PolyGrade foi desenvolvido com uma separação clara entre camadas de dados, negócios e apresentação:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   INTERFACE WEB DO USUÁRIO (UI)                        │
│   Filtros • Seletor de Banco • Medição de Tempos • Árvores de Grafo    │
│                     (http://localhost:3000)                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST API
┌───────────────────────────────────▼────────────────────────────────────┐
│                    BACKEND REST & TELEMETRIA                           │
│     Express • process.hrtime.bigint() • Controladores Multiparadigma   │
└───────────────┬───────────────────┬───────────────────┬────────────────┘
                │                   │                   │
                │ pg (Port 5432)    │ mongo (Port 27017)│ bolt (Port 7687)
┌───────────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│     POSTGRESQL 16      │ │   MONGODB 7.0   │ │     NEO4J 5     │
│   Modelo Relacional    │ │    Documentos   │ │  Grafo Rotulado │
│ (Normalizado em 3FN)   │ │  (Read-Optim.)  │ │  (Index-Free)   │
└────────────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 📁 Estrutura Limpa do Repositório

O repositório foi organizado de forma estritamente modular:

```text
├── backend/
│   ├── public/
│   │   └── index.html            <- Interface Web Moderna (Tailwind CSS + Lucide)
│   ├── package.json              <- Dependências do backend
│   └── server.js                 <- API REST com telemetria e pool de conexões
│
├── data/
│   ├── tads_2019.json            <- Dados canônicos extraídos do SIGAA (37 componentes)
│   ├── curso_exemplo_bti.json    <- Prova de genericidade com matriz do BTI (IMD)
│   └── tads_2019.pdf             <- Documento oficial da UFRN de referência
│
├── modelagem/
│   ├── 1_relacional/             <- Pasta do Modelo Lógico Relacional (3FN)
│   │   ├── README.md             <- Documentação teórica e dicionário de dados
│   │   ├── diagrama_relacional.mmd <- Diagrama Mermaid puro
│   │   ├── visualizar_diagrama.html <- Visualizador web interativo
│   │   └── consultas_exemplos.sql <- Queries com WITH RECURSIVE
│   │
│   ├── 2_documentos/             <- Pasta do Modelo Lógico em Documentos
│   │   ├── README.md             <- Documentação do modelo NoSQL BSON
│   │   ├── diagrama_documentos.mmd <- Diagrama de classes dos documentos
│   │   ├── visualizar_diagrama.html <- Visualizador web interativo
│   │   ├── schema_colecoes.json  <- JSON Schema oficial de validação
│   │   └── consultas_exemplos.js <- Scripts com $graphLookup
│   │
│   ├── 3_grafo/                  <- Pasta do Modelo Lógico em Grafos
│   │   ├── README.md             <- Documentação do Labeled Property Graph
│   │   ├── diagrama_grafo.mmd    <- Diagrama de topologia do grafo
│   │   ├── visualizar_diagrama.html <- Visualizador web interativo
│   │   ├── schema_grafo.cypher   <- Constraints e índices em Cypher
│   │   └── consultas_exemplos.cypher <- Consultas de travessia transitiva
│   │
│   ├── README.md                 <- Sumário dos modelos lógicos
│   └── visualizador_completo.html <- Dashboard com abas para a gravação do vídeo
│
├── scripts/
│   ├── schema_postgres.sql       <- DDL físico relacional com índices
│   ├── start_databases.sh        <- Sobe os 3 bancos locais com limites de CPU/RAM
│   ├── stop_databases.sh         <- Para os containers com segurança
│   ├── seed.js                   <- Script de carga unificado e paridade nos 3 bancos
│   └── test_queries.js           <- Script de benchmark comparativo físico
│
├── docker-compose.yml            <- Configuração Docker oficial dos 3 bancos
├── package.json                  <- Módulos raiz do Node.js
└── README.md                     <- Documento único mestre do projeto
```

---

## 📐 Etapa 1: Modelagem Lógica Multiparadigma

Para atender com máxima fidelidade à regra 1 do professor, cada modelo lógico foi desenvolvido em ferramentas conceituais nativas e isolado em sua própria pasta:

### 1. Abordagem Relacional (SQL / 3FN)
* **Pasta:** [`modelagem/1_relacional/`](modelagem/1_relacional/)
* **Normalização:** 3ª Forma Normal (3FN), desacoplando a entidade `DISCIPLINA` de qualquer curso específico.
* **Resolução de Matrizes:** Tabela associativa `MATRIZ_COMPONENTE` com chave estrangeira composta e restrição `UNIQUE(estrutura_codigo, disciplina_codigo)`.
* **Pré-Requisitos:** Auto-relacionamento na tabela `PRE_REQUISITO` com coluna `operador_logico` (`'E'` ou `'OU'`). A travessia de dependências recursivas utiliza **Common Table Expressions (`WITH RECURSIVE`)**.
* **Visualização:** Abra [`modelagem/1_relacional/visualizar_diagrama.html`](modelagem/1_relacional/visualizar_diagrama.html) no navegador.

### 2. Abordagem em Documentos (MongoDB)
* **Pasta:** [`modelagem/2_documentos/`](modelagem/2_documentos/)
* **Coleção `cursos` (Visão Agregada):** Contém a grade completa organizada por períodos embutidos (*embedded*). Permite carregar a matriz inteira do curso com **uma única leitura atômica sem `JOIN`**.
* **Coleção `disciplinas` (Catálogo Detalhado):** Armazena ementas e o array de dependências (`requisitos: [{ disciplina_codigo, tipo }]`), viabilizando a busca recursiva via estágio `$graphLookup` no Aggregation Pipeline.
* **Visualização:** Abra [`modelagem/2_documentos/visualizar_diagrama.html`](modelagem/2_documentos/visualizar_diagrama.html) no navegador.

### 3. Abordagem em Grafos (Neo4j)
* **Pasta:** [`modelagem/3_grafo/`](modelagem/3_grafo/)
* **Fundamento Matemático:** A estrutura curricular é formalmente um **Grafo Direcionado Acíclico (DAG)**.
* **Nós (*Labels*):** `:Curso`, `:Estrutura`, `:Disciplina`.
* **Arestas (*Relationships*):** `[:POSSUI_ESTRUTURA]`, `[:CONTEM {periodo, tipo_vinculo}]` e `[:EXIGE_PRE_REQUISITO {tipo: 'E'|'OU'}]`.
* **Propriedade Chave:** *Index-Free Adjacency*, com complexidade de navegação $O(1)$ por salto.
* **Visualização:** Abra [`modelagem/3_grafo/visualizar_diagrama.html`](modelagem/3_grafo/visualizar_diagrama.html) no navegador.

> **Visualizador Unificado para o Vídeo:** O arquivo [`modelagem/visualizador_completo.html`](modelagem/visualizador_completo.html) reúne os três modelos em abas clicáveis em tela cheia.

---

## ⚡ Etapa 2: Implementação Física e Controle de Benchmark

### Os 3 Bancos de Dados Locais
Conforme exigido pelo professor, os três motores de banco de dados foram implementados fisicamente em containers Docker locais:

| Banco de Dados | Versão | Container | Porta Local | Quota de CPU | Quota de RAM |
|---|---|---|---|---|---|
| **PostgreSQL** | `16-alpine` | `polygrade_postgres` | `5432` | 1.0 CPU | 1.024 MB |
| **MongoDB** | `7.0` | `polygrade_mongodb` | `27017` | 1.0 CPU | 1.024 MB |
| **Neo4j** | `5-community` | `polygrade_neo4j` | `7474` / `7687` | 1.0 CPU | 1.024 MB |

### A Regra de Ouro do Benchmark Local
> [!IMPORTANT]
> **Controle de Variáveis de Rede:**  
> Se o PostgreSQL rodasse em localhost e o MongoDB em nuvem (ex: MongoDB Atlas), estaríamos medindo a latência da internet (30ms a 120ms de RTT), invalidando o teste.  
> Todos os 3 bancos rodam no **mesmo host local**, conectados pela rede `polygrade_net`, com recursos fixados em 1.0 CPU e 1 GB de RAM.

### Carga e Paridade dos Dados
O script [`scripts/seed.js`](scripts/seed.js) popula os três bancos simultaneamente com dados extraídos do SIGAA:
```text
✓ PostgreSQL: 42 disciplinas e 28 pré-requisitos cadastrados.
✓ MongoDB:    2 cursos e 42 documentos de disciplinas cadastrados.
✓ Neo4j:      42 nós de disciplina e 28 arestas de pré-requisito cadastradas.
>>> 100% DE PARIDADE COMPROVADA NOS 3 BANCOS DE DADOS.
```

### Métricas Reais Obtidas
Executando a busca recursiva de todos os pré-requisitos de **Projetos Aplicados II (TAD0157)**:
- **PostgreSQL (CTE Recursivo):** ~6.38 ms
- **MongoDB ($graphLookup):** ~5.76 ms
- **Neo4j (Cypher Path Traversal):** ~4.00 ms (em cache aquecido)

---

## 🖥 Etapa 3: Sistema Web com UI e Métricas de Resposta

Acesse a aplicação em: **`http://localhost:3000`**

### Recursos da Interface
1. **Seletor Dinâmico de Banco de Dados:** Escolha entre `PostgreSQL`, `MongoDB`, `Neo4j` ou o botão `⚡ Comparar Todos` para disparar a mesma query em paralelo nos três bancos.
2. **Filtros Combinados:**
   - Busca textual por código (`TAD0102`), nome (`Algoritmos`) ou termo na ementa (`Objetos`).
   - Filtro por período ideal (1º ao 6º semestre).
   - Seletor de Curso (`TADS` vs `BTI`).
3. **Cartões Curriculares Ricos:**
   - Código, nome, carga horária e créditos.
   - Badges de pré-requisito clicáveis com semântica booleana (`E` ou `OU`).
   - Botão para abrir a árvore de dependências.
4. **Modal Interativo de Cadeia de Dependências:**
   - Permite visualizar tanto os **Pré-Requisitos (A Montante)** quanto a **Análise de Impacto de Reprovação (A Jusante)**.
   - Permite trocar o banco de dados dentro do modal para testar a recursão ao vivo.

### Telemetria Dupla
O sistema calcula e exibe em tempo real:
* **Tempo de Banco (`db_time_ms`):** Medido com `process.hrtime.bigint()` no backend, medindo estritamente a execução da query no motor do banco.
* **Tempo Total de Resposta (`total_response_time_ms`):** Medido pelo navegador do usuário com `performance.now()` (ciclo completo de transporte de rede + renderização).

---

## 🔄 Etapa 4: Genericidade e Justificativa da Escolha Final

### Como Cadastrar a Estrutura de Outro Curso
O sistema é agnóstico em relação ao TADS:
1. Novas disciplinas são cadastradas sem acoplamento a cursos.
2. A matriz pedagógica é versionada via entidade associativa.
3. Para cadastrar um curso (ex: *Engenharia de Software* ou *BTI*), basta submeter um arquivo JSON canônico.
4. O endpoint dinâmico `POST /api/cursos/cadastrar` propaga automaticamente as informações nos 3 bancos de dados em tempo real, sem necessidade de comandos `ALTER TABLE`.

### Indicação e Justificativa Técnica da Escolha Final

> [!NOTE]
> **Veredito Oficial:**  
> A escolha definitiva para o problema de estruturas curriculares e pré-requisitos é o **Banco de Dados em Grafos (Neo4j)**.

#### Argumentação Técnica:
1. **Natureza do Domínio:** Estruturas curriculares com dependências são **Grafos Direcionados Acíclicos (DAGs)**. Representá-las em tabelas relacionais ou árvores de documentos distorce o modelo real.
2. **Complexidade Assintótica $O(k)$ (*Index-Free Adjacency*):** No Neo4j, o custo de saltar de uma disciplina para outra é $O(1)$ por aresta, pois o nó armazena ponteiros físicos diretos para seus vizinhos. O tempo total de travessia depende apenas do tamanho da subárvore visitada ($k$), e não do volume total de cursos cadastrados no banco ($N$).
3. **Expressividade:** Enquanto o PostgreSQL exige ~30 linhas de SQL com `WITH RECURSIVE` e o MongoDB exige pipelines complexos com `$graphLookup`, no Neo4j a consulta inteira é expressa em **3 linhas de Cypher puro**:
   ```cypher
   MATCH (alvo:Disciplina {codigo: $codigo})-[:EXIGE_PRE_REQUISITO*1..]->(req:Disciplina)
   RETURN req.codigo, req.nome, length(caminho) AS nivel
   ```

---

## 🎬 Etapa 5: Roteiro Oficial para Gravação do Vídeo da Equipe

Roteiro organizado para que todos os membros da equipe participem da gravação:

| Integrante | Papel | Tempo | Tópicos Centrais da Fala |
|---|---|---|---|
| **Pedro Davi** | Abertura, Contexto & Modelagens Lógicas | ~3.0 min | Contextualiza a matriz TADS 2019 da UFRN e a motivação da persistência poliglota. Abre o visualizador [`modelagem/visualizador_completo.html`](modelagem/visualizador_completo.html) e explica os 3 modelos conceituais (Relacional 3FN, Coleções em Documentos e Grafo LPG). |
| **Natanael Lucas** | Demonstração do Sistema Web & UI | ~3.0 min | Compartilha a tela em `http://localhost:3000`. Demonstra a busca textual, filtros por período, visualização de cartões, o modal de cadeia recursiva de pré-requisitos e a alternância dinâmica entre os 3 bancos de dados. |
| **Cleiton Mizael** | Benchmark Local, Escolha Final & Genericidade | ~3.0 min | Executa a query comparativa simultânea ("⚡ Comparar Todos"), explica o rigor científico do benchmark local com containers idênticos (zero viés de rede), defende formalmente a escolha do **Neo4j** (DAG e *Index-Free Adjacency*) e demonstra a genericidade carregando a matriz do BTI. |

---

## 🚀 Como Executar o Projeto em 2 Passos

### Pré-requisitos:
- Docker e Docker Daemon ativos
- Node.js 18+ instalado

### Passo 1: Iniciar os 3 Bancos de Dados Locais e Executar a Carga
```bash
# Inicia os 3 containers com limites de recursos
./scripts/start_databases.sh

# Popula os 3 bancos simultaneamente a partir do JSON canônico
npm run seed
```

### Passo 2: Iniciar a Aplicação Web
```bash
npm start
```
Abra seu navegador em: **`http://localhost:3000`**

Para parar os containers ao final:
```bash
./scripts/stop_databases.sh
```

---
*Projeto desenvolvido para a disciplina de Banco de Dados / Persistência de Dados — UFRN.*

