# Modelo Lógico 1: Abordagem Relacional (SQL / 3FN)

> **Pasta do Modelo:** `modelagem/1_relacional/`  
> **Arquivo do Diagrama:** [diagrama_relacional.mmd](diagrama_relacional.mmd)  
> **Visualizador Web Interativo:** [visualizar_diagrama.html](visualizar_diagrama.html)  
> **Consultas de Exemplo:** [consultas_exemplos.sql](consultas_exemplos.sql)  
> **SGBD Físico Alvo:** PostgreSQL 16  

---

## 1. Fundamentação Teórica e Justificativa da Modelagem

O paradigma relacional fundamenta-se na **Álgebra Relacional** e na teoria dos conjuntos formulada por Edgar F. Codd. Para representar a estrutura curricular do TADS 2019 de forma estritamente normalizada na **3ª Forma Normal (3FN)**, as seguintes premissas de negócio foram aplicadas:

1. **Desacoplamento entre Curso e Disciplina:**  
   Uma disciplina como `TAD0102 - Algoritmos e Programação` possui atributos intrínsecos (nome, carga horária, créditos, departamento, ementa) que não dependem do curso onde ela é ministrada. Se o TADS ou o BTI utilizarem a mesma matéria, seus dados cadastrais não devem ser duplicados.
2. **Entidade Associativa `MATRIZ_COMPONENTE`:**  
   A vinculação de uma disciplina a um curso específico com seu respectivo semestre ideal (1º ao 6º período) e natureza (*OBRIGATÓRIA* ou *OPTATIVA*) é um atributo da relação entre a Matriz Curricular e a Disciplina. Por isso, foi modelada a tabela associativa `MATRIZ_COMPONENTE` com chave estrangeira composta e restrição de unicidade.
3. **Dependências em Auto-Relacionamento com Semântica Booleana:**  
   A relação de pré-requisito é modelada como um auto-relacionamento na tabela `PRE_REQUISITO`. Cada tupla conecta uma `disciplina_alvo_codigo` à sua `disciplina_requisito_codigo`. Além disso, a coluna `operador_logico` armazena os valores `'E'` (conjunção mandatória) e `'OU'` (disjunção alternativa), refletindo com exatidão as regras do fluxograma oficial do SIGAA.

---

## 2. Diagrama Entidade-Relacionamento

```mermaid
erDiagram
    CURSO ||--o{ ESTRUTURA_CURRICULAR : "1:N - oferta"
    ESTRUTURA_CURRICULAR ||--o{ MATRIZ_COMPONENTE : "1:N - estrutura"
    DISCIPLINA ||--o{ MATRIZ_COMPONENTE : "1:N - integra"
    DISCIPLINA ||--o{ PRE_REQUISITO : "1:N - exige (alvo)"
    DISCIPLINA ||--o{ PRE_REQUISITO : "1:N - e_requisito_de"

    CURSO {
        varchar(10) codigo PK "Identificador único do curso (ex: '01A')"
        varchar(20) sigla UK "Sigla usual (ex: 'TADS')"
        varchar(150) nome "Nome completo oficial do curso"
        varchar(50) nivel "Nível acadêmico (ex: 'Graduação - Tecnológico')"
        varchar(120) unidade "Centro acadêmico (ex: 'EAJ - UFRN')"
        varchar(30) modalidade "Presencial ou EaD"
    }

    ESTRUTURA_CURRICULAR {
        varchar(20) codigo_matriz PK "Identificador da matriz (ex: 'TADS2019')"
        varchar(10) curso_codigo FK "FK para CURSO(codigo)"
        int ano_versao "Ano da homologação curricular (2019)"
        int ch_total_minima "Carga horária mínima exigida (2100h)"
        int ch_obrigatoria "Horas de componentes obrigatórios (1680h)"
        int ch_optativa "Horas mínimas optativas (240h)"
        int ch_complementar "Horas de atividades complementares (180h)"
        int duracao_semestres "Duração ideal em semestres (6)"
        boolean ativa "Indica vigência da matriz"
    }

    DISCIPLINA {
        varchar(10) codigo PK "Código do componente (ex: 'TAD0102')"
        varchar(150) nome "Nome da disciplina (ex: 'Algoritmos e Programação')"
        int ch "Carga horária total (ex: 90h)"
        int creditos "Créditos acadêmicos (ex: 6)"
        varchar(30) departamento "Departamento de lotação (ex: 'EAJ')"
        text ementa "Conteúdo programático resumido"
    }

    MATRIZ_COMPONENTE {
        int id PK "Identificador único da vinculação"
        varchar(20) estrutura_codigo FK "FK para ESTRUTURA_CURRICULAR"
        varchar(10) disciplina_codigo FK "FK para DISCIPLINA"
        int periodo_ideal "Semestre recomendado da grade (1 a 6)"
        varchar(30) tipo_vinculo "OBRIGATORIA, OPTATIVA ou COMPLEMENTAR"
    }

    PRE_REQUISITO {
        int id PK "Identificador único da dependência"
        varchar(10) disciplina_alvo_codigo FK "Disciplina que exige o requisito"
        varchar(10) disciplina_requisito_codigo FK "Disciplina necessária"
        varchar(5) operador_logico "Operador booleano: 'E' ou 'OU'"
    }
```

---

## 3. Estratégia de Implementação Física e Índices (PostgreSQL 16)

```sql
-- Índices essenciais para que as consultas de grade e recursão sejam eficientes
CREATE INDEX idx_matriz_estrutura_periodo ON matriz_componente(estrutura_codigo, periodo_ideal);
CREATE INDEX idx_disciplina_nome ON disciplina(nome);
CREATE INDEX idx_pre_requisito_alvo ON pre_requisito(disciplina_alvo_codigo);
CREATE INDEX idx_pre_requisito_origem ON pre_requisito(disciplina_requisito_codigo);
```

---

## 4. Como o Modelo Resolve as Perguntas de Negócio

1. **"Quais são as matérias do 3º período de TADS 2019?"**  
   Resolvido por uma junção direta `matriz_componente` $\bowtie$ `disciplina` filtrando `periodo_ideal = 3`.
2. **"Quais são todos os pré-requisitos necessários para cursar Projetos Aplicados II?"**  
   Resolvido por meio de uma **Common Table Expression Recursiva (`WITH RECURSIVE`)** que navega em profundidade na tabela `pre_requisito`.
3. **"Se o aluno for reprovado em TAD0102, quais matérias ficam trancadas?"**  
   Resolvido pelo CTE recursivo no sentido inverso (a jusante).

