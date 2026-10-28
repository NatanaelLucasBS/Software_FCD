// Consultas de Demonstração do Modelo Não Relacional em Documentos
// Sistema PolyGrade (MongoDB 7.0)

// 1. Obter a grade curricular completa do TADS 2019 em 1 única operação atômica
db.cursos.findOne(
  { sigla: "TADS", ano_versao: 2019 },
  { projection: { grade: 1, nome: 1, ch_total_minima: 1 } }
);

// 2. Filtrar disciplinas de um determinado período (ex: 2º período)
db.disciplinas.find(
  {
    "cursos_vinculados": {
      $elemMatch: {
        curso_sigla: "TADS",
        ano_matriz: 2019,
        periodo_ideal: 2
      }
    }
  },
  { codigo: 1, nome: 1, ch: 1, creditos: 1, requisitos: 1 }
);

// 3. Buscar disciplinas por texto na ementa ou nome (Index Textual)
db.disciplinas.find(
  { $text: { $search: "algoritmos objetos" } },
  { score: { $meta: "textScore" }, codigo: 1, nome: 1, ementa: 1 }
).sort({ score: { $meta: "textScore" } });

// 4. Árvore completa de dependências recursivas usando $graphLookup
// Exemplo: Projetos Aplicados II (TAD0157)
db.disciplinas.aggregate([
  { $match: { codigo: "TAD0157" } },
  {
    $graphLookup: {
      from: "disciplinas",
      startWith: "$requisitos.disciplina_codigo",
      connectFromField: "requisitos.disciplina_codigo",
      connectToField: "codigo",
      as: "cadeia_pre_requisitos",
      maxDepth: 5,
      depthField: "profundidade"
    }
  },
  {
    $project: {
      codigo: 1,
      nome: 1,
      "cadeia_pre_requisitos.codigo": 1,
      "cadeia_pre_requisitos.nome": 1,
      "cadeia_pre_requisitos.profundidade": 1,
      "cadeia_pre_requisitos.ch": 1
    }
  }
]);

// 5. Descobrir quais disciplinas exigem 'Algoritmos e Programação' (TAD0102) como pré-requisito
db.disciplinas.find(
  { "requisitos.disciplina_codigo": "TAD0102" },
  { codigo: 1, nome: 1, "requisitos.$": 1 }
);

