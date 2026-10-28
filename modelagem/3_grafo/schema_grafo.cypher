// Schema DDL e Restrições para Neo4j 5
// Projeto PolyGrade - Modelo em Grafos (LPG)

// 1. Restrição de Unicidade de Disciplinas por Código
CREATE CONSTRAINT unq_disciplina_codigo IF NOT EXISTS
FOR (d:Disciplina) REQUIRE d.codigo IS UNIQUE;

// 2. Restrição de Unicidade de Cursos por Sigla
CREATE CONSTRAINT unq_curso_sigla IF NOT EXISTS
FOR (c:Curso) REQUIRE c.sigla IS UNIQUE;

// 3. Restrição de Unicidade de Estruturas Curriculares
CREATE CONSTRAINT unq_estrutura_codigo IF NOT EXISTS
FOR (e:Estrutura) REQUIRE e.codigo_matriz IS UNIQUE;

// 4. Índices Textuais para buscas eficientes
CREATE TEXT INDEX idx_disciplina_nome IF NOT EXISTS
FOR (d:Disciplina) ON (d.nome);

CREATE TEXT INDEX idx_disciplina_ementa IF NOT EXISTS
FOR (d:Disciplina) ON (d.ementa);

