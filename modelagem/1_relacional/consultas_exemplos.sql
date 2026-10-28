-- Consultas de Demonstração do Modelo Lógico Relacional
-- Sistema PolyGrade (TADS 2019 - UFRN)

-- 1. Listar todas as disciplinas do TADS 2019 agrupadas por período ideal
SELECT 
    mc.periodo_ideal,
    d.codigo,
    d.nome,
    d.ch,
    d.creditos,
    mc.tipo_vinculo
FROM matriz_componente mc
JOIN estrutura_curricular ec ON ec.codigo_matriz = mc.estrutura_codigo
JOIN curso c ON c.codigo = ec.curso_codigo
JOIN disciplina d ON d.codigo = mc.disciplina_codigo
WHERE c.sigla = 'TADS' AND ec.ano_versao = 2019
ORDER BY mc.periodo_ideal, d.codigo;

-- 2. Buscar a cadeia completa de pré-requisitos recursivos de uma disciplina
-- Exemplo: Projetos Aplicados II (TAD0157)
WITH RECURSIVE arvore_requisitos AS (
    -- Caso Base: Pré-requisitos diretos
    SELECT 
        pr.disciplina_alvo_codigo,
        pr.disciplina_requisito_codigo,
        pr.operador_logico,
        1 AS nivel
    FROM pre_requisito pr
    WHERE pr.disciplina_alvo_codigo = 'TAD0157'

    UNION ALL

    -- Passo Recursivo: Pré-requisitos das matérias encontradas
    SELECT 
        pr_prox.disciplina_alvo_codigo,
        pr_prox.disciplina_requisito_codigo,
        pr_prox.operador_logico,
        ar.nivel + 1
    FROM pre_requisito pr_prox
    JOIN arvore_requisitos ar 
      ON pr_prox.disciplina_alvo_codigo = ar.disciplina_requisito_codigo
)
SELECT 
    ar.nivel,
    d.codigo AS codigo_requisito,
    d.nome AS nome_requisito,
    d.ch,
    ar.operador_logico
FROM arvore_requisitos ar
JOIN disciplina d ON d.codigo = ar.disciplina_requisito_codigo
ORDER BY ar.nivel, d.codigo;

-- 3. Análise de impacto: Quais disciplinas dependem de 'Algoritmos e Programação' (TAD0102)?
WITH RECURSIVE disciplinas_dependentes AS (
    SELECT 
        pr.disciplina_alvo_codigo,
        pr.disciplina_requisito_codigo,
        1 AS nivel
    FROM pre_requisito pr
    WHERE pr.disciplina_requisito_codigo = 'TAD0102'

    UNION ALL

    SELECT 
        pr_prox.disciplina_alvo_codigo,
        pr_prox.disciplina_requisito_codigo,
        dd.nivel + 1
    FROM pre_requisito pr_prox
    JOIN disciplinas_dependentes dd 
      ON pr_prox.disciplina_requisito_codigo = dd.disciplina_alvo_codigo
)
SELECT DISTINCT 
    d.codigo,
    d.nome,
    d.ch
FROM disciplinas_dependentes dd
JOIN disciplina d ON d.codigo = dd.disciplina_alvo_codigo
ORDER BY d.codigo;

