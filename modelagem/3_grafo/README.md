# Modelo Lógico 3: Abordagem Não Relacional em Grafos (Neo4j)

> **Pasta do Modelo:** `modelagem/3_grafo/`  
> **Arquivo do Diagrama:** [diagrama_grafo.mmd](diagrama_grafo.mmd)  
> **Visualizador Web Interativo:** [visualizar_diagrama.html](visualizar_diagrama.html)  
> **Schema e Restrições:** [schema_grafo.cypher](schema_grafo.cypher)  
> **Consultas de Exemplo:** [consultas_exemplos.cypher](consultas_exemplos.cypher)  
> **SGBD Físico Alvo:** Neo4j 5 Community Edition  

---

## 1. Fundamentação Teórica e Justificativa da Modelagem

O paradigma de grafos rotulados com propriedades (*Labeled Property Graph - LPG*) é a representação matemática mais natural para o problema de estruturas curriculares acadêmicas. O currículo de um curso universitário é, por definição formal, um **Grafo Direcionado Acíclico (DAG - Directed Acyclic Graph)**, onde:
- Os **vértices** são as disciplinas e estruturas.
- As **arestas direcionadas** são os pré-requisitos e vinculações da matriz.

### Por que o modelo em Grafos é conceitualmente superior para este problema?
1. **Adjacência Livre de Índices (*Index-Free Adjacency*):**  
   Em bancos relacionais ou de documentos, encontrar o pré-requisito de uma disciplina exige consultar um índice B-Tree (com custo de $O(\log N)$) para localizar o identificador da próxima disciplina na tabela. No Neo4j, **cada nó já contém os ponteiros de memória/disco diretos para suas arestas e nós vizinhos**. O custo de travessia de cada passo é $O(1)$.
2. **Complexidade Independente do Tamanho Total do Banco:**  
   Não importa se o banco possui 10 cursos ou 10.000 cursos cadastrados: o tempo para percorrer a árvore de pré-requisitos de *Projetos Aplicados II* depende unicamente do número de nós visitados naquele caminho específico ($O(k)$), e não do volume total de dados ($N$).
3. **Poder e Expressividade da Linguagem Cypher:**  
   A linguagem Cypher permite expressar caminhos de profundidade variável sem necessidade de laços de repetição nem Common Table Expressions (CTEs):
   ```cypher
   MATCH (alvo:Disciplina {codigo: 'TAD0157'})-[:EXIGE_PRE_REQUISITO*1..]->(req:Disciplina)
   RETURN req.codigo, req.nome
   ```

---

## 2. Diagrama Conceitual e Topologia do Grafo

```mermaid
flowchart TD
    %% Nós principais
    C["(:Curso {codigo: '01A', sigla: 'TADS'})"]
    E["(:Estrutura {codigo: 'TADS2019', ano: 2019, ch_min: 2100})"]

    %% Disciplinas do TADS 2019
    D0102["(:Disciplina {codigo: 'TAD0102', nome: 'Algoritmos e Prog.', ch: 90})"]
    D0009["(:Disciplina {codigo: 'TAD0009', nome: 'Prog. Orientada a Objetos', ch: 60})"]
    D0019["(:Disciplina {codigo: 'TAD0019', nome: 'Programação Web', ch: 60})"]
    D0027["(:Disciplina {codigo: 'TAD0027', nome: 'Prog. Dispositivos Móveis', ch: 90})"]
    D0028["(:Disciplina {codigo: 'TAD0028', nome: 'Planej. e Gerência Projetos', ch: 45})"]
    D0029["(:Disciplina {codigo: 'TAD0029', nome: 'Arquitetura de Software', ch: 45})"]
    D0156["(:Disciplina {codigo: 'TAD0156', nome: 'Projetos Aplicados I', ch: 60})"]
    D0157["(:Disciplina {codigo: 'TAD0157', nome: 'Projetos Aplicados II', ch: 60})"]

    %% Relações de Pertencimento Curricular
    C -->|POSSUI_ESTRUTURA| E
    E -->|CONTEM {periodo: 1, tipo: 'OBRIGATORIA'}| D0102
    E -->|CONTEM {periodo: 2, tipo: 'OBRIGATORIA'}| D0009
    E -->|CONTEM {periodo: 3, tipo: 'OBRIGATORIA'}| D0019
    E -->|CONTEM {periodo: 4, tipo: 'OBRIGATORIA'}| D0027
    E -->|CONTEM {periodo: 4, tipo: 'OBRIGATORIA'}| D0028
    E -->|CONTEM {periodo: 4, tipo: 'OBRIGATORIA'}| D0029
    E -->|CONTEM {periodo: 5, tipo: 'OBRIGATORIA'}| D0156
    E -->|CONTEM {periodo: 6, tipo: 'OBRIGATORIA'}| D0157

    %% Relações de Pré-Requisitos (DAG - Directed Acyclic Graph)
    D0009 -->|EXIGE_PRE_REQUISITO {tipo: 'E'}| D0102
    D0019 -->|EXIGE_PRE_REQUISITO {tipo: 'E'}| D0009
    D0027 -->|EXIGE_PRE_REQUISITO {tipo: 'E'}| D0019
    D0028 -.->|EXIGE_PRE_REQUISITO {tipo: 'OU'}| D0009
    D0029 -.->|EXIGE_PRE_REQUISITO {tipo: 'OU'}| D0009
    D0156 -->|EXIGE_PRE_REQUISITO {tipo: 'E'}| D0102
    D0156 -->|EXIGE_PRE_REQUISITO {tipo: 'E'}| D0029
    D0157 -->|EXIGE_PRE_REQUISITO {tipo: 'E'}| D0156
    D0157 -->|EXIGE_PRE_REQUISITO {tipo: 'E'}| D0028
```

---

## 3. Especificação dos Elementos do Grafo

1. **Nó `:Curso`**: Armazena as informações gerais do curso (`codigo`, `sigla`, `nome`, `nivel`, `unidade`).
2. **Nó `:Estrutura`**: Versão da matriz pedagógica (`codigo_matriz`, `ano_versao`, `ch_total_minima`, `duracao_semestres`).
3. **Nó `:Disciplina`**: Componente pedagógico agnóstico (`codigo`, `nome`, `ch`, `creditos`, `departamento`, `ementa`).
4. **Aresta `[:POSSUI_ESTRUTURA]`**: Liga o curso à matriz vigente.
5. **Aresta `[:CONTEM]`**: Liga a matriz à disciplina, contendo as propriedades `{periodo: int, tipo_vinculo: string}`.
6. **Aresta `[:EXIGE_PRE_REQUISITO]`**: Liga a disciplina dependente à disciplina precedente, com a propriedade `{tipo: 'E' | 'OU'}`.

---

## 4. Comparativo de Vantagens e Trade-offs

* **Vantagens:**
  - Semântica 100% fiel à realidade da estrutura curricular.
  - Queries de pré-requisitos e impacto (*impact analysis*) são escritas em poucas linhas declarativas.
  - Menor tempo de CPU para resolver grafos complexos e caminhos mais curtos (`shortestPath`).
* **Trade-offs:**
  - O motor do Neo4j exige mais memória RAM alocada para manter o grafo em memória primária.
  - Não é tão otimizado para agregações numéricas em larga escala (ex: calcular a média salarial de 1 milhão de ex-alunos) quanto um banco analítico colunar ou relacional.

