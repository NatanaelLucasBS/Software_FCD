// Consultas de Demonstração do Modelo Não Relacional em Grafos (OpenCypher)
// Sistema PolyGrade (Neo4j 5)

// 1. Listar todas as disciplinas do TADS 2019 ordenadas por período ideal
MATCH (c:Curso {sigla: 'TADS'})-[:POSSUI_ESTRUTURA]->(e:Estrutura {ano_versao: 2019})
MATCH (e)-[r:CONTEM]->(d:Disciplina)
RETURN 
    r.periodo AS periodo,
    d.codigo AS codigo,
    d.nome AS nome,
    d.ch AS ch,
    d.creditos AS creditos,
    r.tipo_vinculo AS tipo_vinculo
ORDER BY periodo, codigo;

// 2. Buscar a Árvore Completa de Pré-requisitos de uma Disciplina (Caminho Transitivo)
// Exemplo: Projetos Aplicados II (TAD0157)
MATCH caminho = (alvo:Disciplina {codigo: 'TAD0157'})-[:EXIGE_PRE_REQUISITO*1..]->(req:Disciplina)
RETURN 
    req.codigo AS codigo_requisito,
    req.nome AS nome_requisito,
    length(caminho) AS nivel_profundidade,
    [rel IN relationships(caminho) | rel.tipo] AS operadores_logicos
ORDER BY nivel_profundidade, codigo_requisito;

// 3. Análise de Impacto: "Quais disciplinas ficam bloqueadas se o discente não cursar TAD0102?"
MATCH (origem:Disciplina {codigo: 'TAD0102'})<-[:EXIGE_PRE_REQUISITO*1..]-(travada:Disciplina)
RETURN DISTINCT 
    travada.codigo AS codigo_bloqueado,
    travada.nome AS disciplina_impactada,
    travada.ch AS ch
ORDER BY travada.codigo;

// 4. Descobrir o menor caminho de pré-requisitos entre Fundamentos e Projetos Aplicados II
MATCH p = shortestPath(
    (fim:Disciplina {codigo: 'TAD0157'})-[:EXIGE_PRE_REQUISITO*..10]->(inicio:Disciplina {codigo: 'TAD0102'})
)
RETURN [n IN nodes(p) | n.codigo] AS sequencia_de_materias, length(p) AS passos;

