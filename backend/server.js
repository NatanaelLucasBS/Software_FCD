import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import neo4j from 'neo4j-driver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/modelagem', express.static(path.join(rootDir, 'modelagem')));

// ==========================================
// 1. Conexões com os Bancos de Dados
// ==========================================

// PostgreSQL Pool
const pgPool = new pg.Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'polygrade',
  password: process.env.PG_PASSWORD || 'polygrade_pwd',
  database: process.env.PG_DATABASE || 'curriculo_db',
  max: 20
});

// MongoDB Client
const mongoUri = process.env.MONGO_URI || 'mongodb://polygrade:polygrade_pwd@localhost:27017/curriculo_db?authSource=admin';
const mongoClient = new MongoClient(mongoUri, { maxPoolSize: 20 });
let mongoDb = null;

// Neo4j Driver
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jDriver = neo4j.driver(neo4jUri, neo4j.auth.basic(
  process.env.NEO4J_USER || 'neo4j',
  process.env.NEO4J_PASSWORD || 'polygrade_pwd'
));

async function initDatabases() {
  try {
    await mongoClient.connect();
    mongoDb = mongoClient.db('curriculo_db');
    console.log('✓ Conectado ao MongoDB');

    const pgClient = await pgPool.connect();
    pgClient.release();
    console.log('✓ Conectado ao PostgreSQL');

    const neoSession = neo4jDriver.session();
    await neoSession.run('RETURN 1');
    await neoSession.close();
    console.log('✓ Conectado ao Neo4j');
  } catch (err) {
    console.error('Aviso na inicialização dos bancos:', err.message);
  }
}
initDatabases();

// Helper de tempo de alta precisão em ms
function measureTimeMs(t0) {
  const diff = process.hrtime.bigint() - t0;
  return Number(diff) / 1_000_000;
}

// ==========================================
// 2. Controladores de Consulta Específicos
// ==========================================

// --- A) PostgreSQL Queries ---
const pgQueries = {
  async getGrade(cursoSigla = 'TADS', periodo = null, search = '') {
    const t0 = process.hrtime.bigint();
    let query = `
      SELECT 
        mc.periodo_ideal,
        d.codigo,
        d.nome,
        d.ch,
        d.creditos,
        d.departamento,
        d.ementa,
        mc.tipo_vinculo,
        COALESCE(
          json_agg(
            json_build_object(
              'disciplina_codigo', pr.disciplina_requisito_codigo,
              'tipo', pr.operador_logico
            )
          ) FILTER (WHERE pr.disciplina_requisito_codigo IS NOT NULL), '[]'
        ) AS requisitos
      FROM matriz_componente mc
      JOIN estrutura_curricular ec ON ec.codigo_matriz = mc.estrutura_codigo
      JOIN curso c ON c.codigo = ec.curso_codigo
      JOIN disciplina d ON d.codigo = mc.disciplina_codigo
      LEFT JOIN pre_requisito pr ON pr.disciplina_alvo_codigo = d.codigo
      WHERE c.sigla = $1
    `;
    const params = [cursoSigla];
    let pIdx = 2;

    if (periodo) {
      query += ` AND mc.periodo_ideal = $${pIdx++}`;
      params.push(parseInt(periodo, 10));
    }
    if (search) {
      query += ` AND (d.codigo ILIKE $${pIdx} OR d.nome ILIKE $${pIdx} OR d.ementa ILIKE $${pIdx})`;
      params.push(`%${search}%`);
      pIdx++;
    }

    query += `
      GROUP BY mc.periodo_ideal, d.codigo, d.nome, d.ch, d.creditos, d.departamento, d.ementa, mc.tipo_vinculo
      ORDER BY mc.periodo_ideal, d.codigo;
    `;

    const res = await pgPool.query(query, params);
    const db_time_ms = measureTimeMs(t0);
    return { db: 'postgres', db_time_ms, count: res.rows.length, data: res.rows, query_raw: query };
  },

  async getPreRequisitos(disciplinaCodigo) {
    const t0 = process.hrtime.bigint();
    const query = `
      WITH RECURSIVE arvore_requisitos AS (
        SELECT 
          pr.disciplina_alvo_codigo,
          pr.disciplina_requisito_codigo,
          pr.operador_logico,
          1 AS nivel
        FROM pre_requisito pr
        WHERE pr.disciplina_alvo_codigo = $1

        UNION ALL

        SELECT 
          pr_prox.disciplina_alvo_codigo,
          pr_prox.disciplina_requisito_codigo,
          pr_prox.operador_logico,
          ar.nivel + 1
        FROM pre_requisito pr_prox
        JOIN arvore_requisitos ar 
          ON pr_prox.disciplina_alvo_codigo = ar.disciplina_requisito_codigo
      )
      SELECT DISTINCT
        d.codigo,
        d.nome,
        d.ch,
        d.creditos,
        ar.nivel,
        ar.operador_logico
      FROM arvore_requisitos ar
      JOIN disciplina d ON d.codigo = ar.disciplina_requisito_codigo
      ORDER BY ar.nivel, d.codigo;
    `;
    const res = await pgPool.query(query, [disciplinaCodigo]);
    const db_time_ms = measureTimeMs(t0);
    return { db: 'postgres', db_time_ms, count: res.rows.length, data: res.rows, query_raw: query };
  },

  async getImpacto(disciplinaCodigo) {
    const t0 = process.hrtime.bigint();
    const query = `
      WITH RECURSIVE materias_travadas AS (
        SELECT 
          pr.disciplina_alvo_codigo,
          pr.disciplina_requisito_codigo,
          1 AS nivel
        FROM pre_requisito pr
        WHERE pr.disciplina_requisito_codigo = $1

        UNION ALL

        SELECT 
          pr_prox.disciplina_alvo_codigo,
          pr_prox.disciplina_requisito_codigo,
          mt.nivel + 1
        FROM pre_requisito pr_prox
        JOIN materias_travadas mt 
          ON pr_prox.disciplina_requisito_codigo = mt.disciplina_alvo_codigo
      )
      SELECT DISTINCT
        d.codigo,
        d.nome,
        d.ch,
        mt.nivel
      FROM materias_travadas mt
      JOIN disciplina d ON d.codigo = mt.disciplina_alvo_codigo
      ORDER BY mt.nivel, d.codigo;
    `;
    const res = await pgPool.query(query, [disciplinaCodigo]);
    const db_time_ms = measureTimeMs(t0);
    return { db: 'postgres', db_time_ms, count: res.rows.length, data: res.rows, query_raw: query };
  }
};

// --- B) MongoDB Queries ---
const mongoQueries = {
  async getGrade(cursoSigla = 'TADS', periodo = null, search = '') {
    const t0 = process.hrtime.bigint();
    const col = mongoDb.collection('disciplinas');

    const filter = {
      'cursos_vinculados.curso_sigla': cursoSigla
    };

    if (periodo) {
      filter['cursos_vinculados'] = {
        $elemMatch: {
          curso_sigla: cursoSigla,
          periodo_ideal: parseInt(periodo, 10)
        }
      };
    }

    if (search) {
      filter.$or = [
        { codigo: { $regex: search, $options: 'i' } },
        { nome: { $regex: search, $options: 'i' } },
        { ementa: { $regex: search, $options: 'i' } }
      ];
    }

    const docs = await col.find(filter).toArray();

    // Normaliza para o mesmo formato de resposta
    const data = docs.map(d => {
      const vinculo = d.cursos_vinculados?.find(v => v.curso_sigla === cursoSigla);
      return {
        periodo_ideal: vinculo?.periodo_ideal || 0,
        codigo: d.codigo,
        nome: d.nome,
        ch: d.ch,
        creditos: d.creditos,
        departamento: d.departamento,
        ementa: d.ementa,
        tipo_vinculo: vinculo?.tipo_vinculo || 'OBRIGATORIA',
        requisitos: d.requisitos || []
      };
    }).sort((a, b) => a.periodo_ideal - b.periodo_ideal || a.codigo.localeCompare(b.codigo));

    const db_time_ms = measureTimeMs(t0);
    return { db: 'mongo', db_time_ms, count: data.length, data, query_raw: JSON.stringify(filter) };
  },

  async getPreRequisitos(disciplinaCodigo) {
    const t0 = process.hrtime.bigint();
    const col = mongoDb.collection('disciplinas');

    const pipeline = [
      { $match: { codigo: disciplinaCodigo } },
      {
        $graphLookup: {
          from: 'disciplinas',
          startWith: '$requisitos.disciplina_codigo',
          connectFromField: 'requisitos.disciplina_codigo',
          connectToField: 'codigo',
          as: 'arvore',
          maxDepth: 5,
          depthField: 'nivel'
        }
      },
      {
        $project: {
          arvore: {
            $map: {
              input: '$arvore',
              as: 'item',
              in: {
                codigo: '$$item.codigo',
                nome: '$$item.nome',
                ch: '$$item.ch',
                creditos: '$$item.creditos',
                nivel: { $add: ['$$item.nivel', 1] }
              }
            }
          }
        }
      }
    ];

    const result = await col.aggregate(pipeline).toArray();
    const db_time_ms = measureTimeMs(t0);
    const data = (result[0]?.arvore || []).sort((a, b) => a.nivel - b.nivel || a.codigo.localeCompare(b.codigo));
    return { db: 'mongo', db_time_ms, count: data.length, data, query_raw: JSON.stringify(pipeline) };
  },

  async getImpacto(disciplinaCodigo) {
    const t0 = process.hrtime.bigint();
    const col = mongoDb.collection('disciplinas');

    const pipeline = [
      { $match: { codigo: disciplinaCodigo } },
      {
        $graphLookup: {
          from: 'disciplinas',
          startWith: '$codigo',
          connectFromField: 'codigo',
          connectToField: 'requisitos.disciplina_codigo',
          as: 'impactadas',
          maxDepth: 5,
          depthField: 'nivel'
        }
      },
      {
        $project: {
          impactadas: {
            $map: {
              input: '$impactadas',
              as: 'item',
              in: {
                codigo: '$$item.codigo',
                nome: '$$item.nome',
                ch: '$$item.ch',
                nivel: { $add: ['$$item.nivel', 1] }
              }
            }
          }
        }
      }
    ];

    const result = await col.aggregate(pipeline).toArray();
    const db_time_ms = measureTimeMs(t0);
    const data = (result[0]?.impactadas || []).sort((a, b) => a.nivel - b.nivel || a.codigo.localeCompare(b.codigo));
    return { db: 'mongo', db_time_ms, count: data.length, data, query_raw: JSON.stringify(pipeline) };
  }
};

// --- C) Neo4j Queries ---
const neo4jQueries = {
  async getGrade(cursoSigla = 'TADS', periodo = null, search = '') {
    const session = neo4jDriver.session();
    const t0 = process.hrtime.bigint();

    try {
      let cypher = `
        MATCH (c:Curso {sigla: $cursoSigla})-[:POSSUI_ESTRUTURA]->(e:Estrutura)
        MATCH (e)-[r:CONTEM]->(d:Disciplina)
        WHERE 1=1
      `;
      const params = { cursoSigla };

      if (periodo) {
        cypher += ` AND r.periodo = $periodo`;
        params.periodo = neo4j.int(parseInt(periodo, 10));
      }

      if (search) {
        cypher += ` AND (d.codigo =~ $regex OR d.nome =~ $regex OR d.ementa =~ $regex)`;
        params.regex = `(?i).*${search}.*`;
      }

      cypher += `
        OPTIONAL MATCH (d)-[reqRel:EXIGE_PRE_REQUISITO]->(req:Disciplina)
        WITH r.periodo AS periodo_ideal, d, r.tipo_vinculo AS tipo_vinculo,
             collect(DISTINCT { disciplina_codigo: req.codigo, tipo: reqRel.tipo }) AS requisitos
        RETURN 
          periodo_ideal,
          d.codigo AS codigo,
          d.nome AS nome,
          d.ch AS ch,
          d.creditos AS creditos,
          d.departamento AS departamento,
          d.ementa AS ementa,
          tipo_vinculo,
          [x IN requisitos WHERE x.disciplina_codigo IS NOT NULL] AS requisitos
        ORDER BY periodo_ideal, codigo;
      `;

      const res = await session.run(cypher, params);
      const db_time_ms = measureTimeMs(t0);

      const data = res.records.map(record => ({
        periodo_ideal: record.get('periodo_ideal').toNumber ? record.get('periodo_ideal').toNumber() : record.get('periodo_ideal'),
        codigo: record.get('codigo'),
        nome: record.get('nome'),
        ch: record.get('ch').toNumber ? record.get('ch').toNumber() : record.get('ch'),
        creditos: record.get('creditos').toNumber ? record.get('creditos').toNumber() : record.get('creditos'),
        departamento: record.get('departamento'),
        ementa: record.get('ementa'),
        tipo_vinculo: record.get('tipo_vinculo'),
        requisitos: record.get('requisitos') || []
      }));

      return { db: 'neo4j', db_time_ms, count: data.length, data, query_raw: cypher };
    } finally {
      await session.close();
    }
  },

  async getPreRequisitos(disciplinaCodigo) {
    const session = neo4jDriver.session();
    const t0 = process.hrtime.bigint();

    try {
      const cypher = `
        MATCH caminho = (alvo:Disciplina {codigo: $disciplinaCodigo})-[:EXIGE_PRE_REQUISITO*1..]->(req:Disciplina)
        WITH req, min(length(caminho)) AS nivel, last(relationships(caminho)).tipo AS operador_logico
        RETURN 
          req.codigo AS codigo,
          req.nome AS nome,
          req.ch AS ch,
          req.creditos AS creditos,
          nivel,
          operador_logico
        ORDER BY nivel, codigo;
      `;

      const res = await session.run(cypher, { disciplinaCodigo });
      const db_time_ms = measureTimeMs(t0);

      const data = res.records.map(record => ({
        codigo: record.get('codigo'),
        nome: record.get('nome'),
        ch: record.get('ch').toNumber ? record.get('ch').toNumber() : record.get('ch'),
        creditos: record.get('creditos').toNumber ? record.get('creditos').toNumber() : record.get('creditos'),
        nivel: record.get('nivel').toNumber ? record.get('nivel').toNumber() : record.get('nivel'),
        operador_logico: record.get('operador_logico')
      }));

      return { db: 'neo4j', db_time_ms, count: data.length, data, query_raw: cypher };
    } finally {
      await session.close();
    }
  },

  async getImpacto(disciplinaCodigo) {
    const session = neo4jDriver.session();
    const t0 = process.hrtime.bigint();

    try {
      const cypher = `
        MATCH caminho = (origem:Disciplina {codigo: $disciplinaCodigo})<-[:EXIGE_PRE_REQUISITO*1..]-(travada:Disciplina)
        WITH travada, min(length(caminho)) AS nivel
        RETURN 
          travada.codigo AS codigo,
          travada.nome AS nome,
          travada.ch AS ch,
          nivel
        ORDER BY nivel, codigo;
      `;

      const res = await session.run(cypher, { disciplinaCodigo });
      const db_time_ms = measureTimeMs(t0);

      const data = res.records.map(record => ({
        codigo: record.get('codigo'),
        nome: record.get('nome'),
        ch: record.get('ch').toNumber ? record.get('ch').toNumber() : record.get('ch'),
        nivel: record.get('nivel').toNumber ? record.get('nivel').toNumber() : record.get('nivel')
      }));

      return { db: 'neo4j', db_time_ms, count: data.length, data, query_raw: cypher };
    } finally {
      await session.close();
    }
  }
};

// ==========================================
// 3. Rotas da API REST
// ==========================================

// Rota para visualização dos modelos lógicos (Mermaid)
app.get('/modelos_visuais', (req, res) => {
  res.sendFile(path.join(rootDir, 'modelagem', 'visualizador_completo.html'));
});

// Lista cursos disponíveis
app.get('/api/cursos', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT codigo, sigla, nome, nivel, unidade FROM curso ORDER BY sigla;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Consulta Principal (Grade ou Filtros)
app.get('/api/consulta', async (req, res) => {
  const { db = 'postgres', curso = 'TADS', periodo, q } = req.query;

  try {
    if (db === 'all') {
      // Modo Benchmark: executa nos 3 bancos
      const [pgResult, mongoResult, neoResult] = await Promise.all([
        pgQueries.getGrade(curso, periodo, q),
        mongoQueries.getGrade(curso, periodo, q),
        neo4jQueries.getGrade(curso, periodo, q)
      ]);

      return res.json({
        modo: 'benchmark',
        resultados: {
          postgres: pgResult,
          mongo: mongoResult,
          neo4j: neoResult
        },
        tempos: {
          postgres_ms: pgResult.db_time_ms,
          mongo_ms: mongoResult.db_time_ms,
          neo4j_ms: neoResult.db_time_ms
        },
        dados: pgResult.data // Base para renderização
      });
    }

    let resultado;
    if (db === 'mongo') {
      resultado = await mongoQueries.getGrade(curso, periodo, q);
    } else if (db === 'neo4j') {
      resultado = await neo4jQueries.getGrade(curso, periodo, q);
    } else {
      resultado = await pgQueries.getGrade(curso, periodo, q);
    }

    res.json(resultado);
  } catch (err) {
    console.error('Erro na consulta /api/consulta:', err);
    res.status(500).json({ error: err.message });
  }
});

// Consulta de Pré-Requisitos e Impacto
app.get('/api/dependencias/:codigo', async (req, res) => {
  const { codigo } = req.params;
  const { db = 'postgres', tipo = 'requisitos' } = req.query;

  try {
    if (db === 'all') {
      const isReq = tipo === 'requisitos';
      const [pgResult, mongoResult, neoResult] = await Promise.all([
        isReq ? pgQueries.getPreRequisitos(codigo) : pgQueries.getImpacto(codigo),
        isReq ? mongoQueries.getPreRequisitos(codigo) : mongoQueries.getImpacto(codigo),
        isReq ? neo4jQueries.getPreRequisitos(codigo) : neo4jQueries.getImpacto(codigo)
      ]);

      return res.json({
        modo: 'benchmark',
        tipo,
        disciplina_alvo: codigo,
        resultados: {
          postgres: pgResult,
          mongo: mongoResult,
          neo4j: neoResult
        },
        tempos: {
          postgres_ms: pgResult.db_time_ms,
          mongo_ms: mongoResult.db_time_ms,
          neo4j_ms: neoResult.db_time_ms
        },
        dados: neoResult.data
      });
    }

    let resultado;
    if (tipo === 'impacto') {
      if (db === 'mongo') resultado = await mongoQueries.getImpacto(codigo);
      else if (db === 'neo4j') resultado = await neo4jQueries.getImpacto(codigo);
      else resultado = await pgQueries.getImpacto(codigo);
    } else {
      if (db === 'mongo') resultado = await mongoQueries.getPreRequisitos(codigo);
      else if (db === 'neo4j') resultado = await neo4jQueries.getPreRequisitos(codigo);
      else resultado = await pgQueries.getPreRequisitos(codigo);
    }

    res.json(resultado);
  } catch (err) {
    console.error('Erro em /api/dependencias:', err);
    res.status(500).json({ error: err.message });
  }
});

// Rota para Cadastro Dinâmico de Novo Curso (Comprovação da Genericidade)
app.post('/api/cursos/cadastrar', async (req, res) => {
  const dataset = req.body;
  if (!dataset || !dataset.curso || !dataset.estrutura || !dataset.componentes) {
    return res.status(400).json({ error: 'Formato inválido. O JSON deve conter: curso, estrutura e componentes.' });
  }

  const { curso, estrutura, componentes } = dataset;
  const resultados = { postgres: false, mongo: false, neo4j: false };

  try {
    // 1. Inserir no PostgreSQL
    const pgClient = await pgPool.connect();
    try {
      await pgClient.query('BEGIN');
      await pgClient.query(
        `INSERT INTO curso (codigo, sigla, nome, nivel, unidade, modalidade)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (codigo) DO UPDATE SET sigla = EXCLUDED.sigla, nome = EXCLUDED.nome;`,
        [curso.codigo, curso.sigla, curso.nome, curso.nivel, curso.unidade, curso.modalidade || 'Presencial']
      );

      await pgClient.query(
        `INSERT INTO estrutura_curricular (codigo_matriz, curso_codigo, ano_versao, ch_total_minima, ch_obrigatoria, ch_optativa, ch_complementar, duracao_semestres, ativa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (codigo_matriz) DO NOTHING;`,
        [estrutura.codigo_matriz, curso.codigo, estrutura.ano_versao, estrutura.ch_total_minima, estrutura.ch_obrigatoria || 0, estrutura.ch_optativa || 0, estrutura.ch_complementar || 0, estrutura.duracao_padrao_semestres || 6, true]
      );

      for (const comp of componentes) {
        await pgClient.query(
          `INSERT INTO disciplina (codigo, nome, ch, creditos, departamento, ementa)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, ch = EXCLUDED.ch, creditos = EXCLUDED.creditos, ementa = EXCLUDED.ementa;`,
          [comp.codigo, comp.nome, comp.ch, comp.creditos, comp.departamento, comp.ementa]
        );

        await pgClient.query(
          `INSERT INTO matriz_componente (estrutura_codigo, disciplina_codigo, periodo_ideal, tipo_vinculo)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (estrutura_codigo, disciplina_codigo) DO UPDATE SET periodo_ideal = EXCLUDED.periodo_ideal, tipo_vinculo = EXCLUDED.tipo_vinculo;`,
          [estrutura.codigo_matriz, comp.codigo, comp.periodo_ideal, comp.tipo_vinculo]
        );
      }

      for (const comp of componentes) {
        if (comp.requisitos && comp.requisitos.length > 0) {
          for (const reqItem of comp.requisitos) {
            await pgClient.query(
              `INSERT INTO pre_requisito (disciplina_alvo_codigo, disciplina_requisito_codigo, operador_logico)
               VALUES ($1, $2, $3)
               ON CONFLICT (disciplina_alvo_codigo, disciplina_requisito_codigo) DO UPDATE SET operador_logico = EXCLUDED.operador_logico;`,
              [comp.codigo, reqItem.disciplina_codigo, reqItem.tipo || 'E']
            );
          }
        }
      }
      await pgClient.query('COMMIT');
      resultados.postgres = true;
    } catch (e) {
      await pgClient.query('ROLLBACK');
      throw e;
    } finally {
      pgClient.release();
    }

    // 2. Inserir no MongoDB
    const colCursos = mongoDb.collection('cursos');
    const colDisc = mongoDb.collection('disciplinas');

    const gradeMap = new Map();
    for (const comp of componentes) {
      if (!gradeMap.has(comp.periodo_ideal)) gradeMap.set(comp.periodo_ideal, []);
      gradeMap.get(comp.periodo_ideal).push({
        codigo: comp.codigo,
        nome: comp.nome,
        ch: comp.ch,
        creditos: comp.creditos,
        tipo_vinculo: comp.tipo_vinculo
      });
    }

    const gradeArray = Array.from(gradeMap.entries())
      .sort(([p1], [p2]) => p1 - p2)
      .map(([periodo, disciplinas]) => ({ periodo, disciplinas }));

    await colCursos.updateOne(
      { _id: `${curso.sigla}_${estrutura.ano_versao}` },
      {
        $set: {
          codigo: curso.codigo,
          sigla: curso.sigla,
          nome: curso.nome,
          nivel: curso.nivel,
          unidade: curso.unidade,
          ano_versao: estrutura.ano_versao,
          ch_total_minima: estrutura.ch_total_minima,
          duracao_semestres: estrutura.duracao_padrao_semestres || 6,
          grade: gradeArray
        }
      },
      { upsert: true }
    );

    for (const comp of componentes) {
      await colDisc.updateOne(
        { codigo: comp.codigo },
        {
          $set: {
            _id: comp.codigo,
            codigo: comp.codigo,
            nome: comp.nome,
            ch: comp.ch,
            creditos: comp.creditos,
            departamento: comp.departamento,
            ementa: comp.ementa,
            cursos_vinculados: [
              {
                curso_sigla: curso.sigla,
                ano_matriz: estrutura.ano_versao,
                periodo_ideal: comp.periodo_ideal,
                tipo_vinculo: comp.tipo_vinculo
              }
            ],
            requisitos: comp.requisitos || []
          }
        },
        { upsert: true }
      );
    }
    resultados.mongo = true;

    // 3. Inserir no Neo4j
    const neoSession = neo4jDriver.session();
    try {
      await neoSession.run(
        `MERGE (c:Curso {sigla: $sigla})
         ON CREATE SET c.codigo = $codigo, c.nome = $nome, c.nivel = $nivel, c.unidade = $unidade
         MERGE (e:Estrutura {codigo_matriz: $codigo_matriz})
         ON CREATE SET e.ano_versao = $ano_versao, e.ch_total_minima = $ch_total_minima, e.duracao_semestres = $duracao_semestres
         MERGE (c)-[:POSSUI_ESTRUTURA]->(e);`,
        {
          sigla: curso.sigla,
          codigo: curso.codigo,
          nome: curso.nome,
          nivel: curso.nivel,
          unidade: curso.unidade,
          codigo_matriz: estrutura.codigo_matriz,
          ano_versao: estrutura.ano_versao,
          ch_total_minima: estrutura.ch_total_minima,
          duracao_semestres: estrutura.duracao_padrao_semestres || 6
        }
      );

      for (const comp of componentes) {
        await neoSession.run(
          `MERGE (d:Disciplina {codigo: $codigo})
           ON CREATE SET d.nome = $nome, d.ch = $ch, d.creditos = $creditos, d.departamento = $departamento, d.ementa = $ementa
           WITH d
           MATCH (e:Estrutura {codigo_matriz: $codigo_matriz})
           MERGE (e)-[r:CONTEM]->(d)
           SET r.periodo = $periodo, r.tipo_vinculo = $tipo_vinculo;`,
          {
            codigo: comp.codigo,
            nome: comp.nome,
            ch: comp.ch,
            creditos: comp.creditos,
            departamento: comp.departamento,
            ementa: comp.ementa,
            codigo_matriz: estrutura.codigo_matriz,
            periodo: comp.periodo_ideal,
            tipo_vinculo: comp.tipo_vinculo
          }
        );
      }

      for (const comp of componentes) {
        if (comp.requisitos && comp.requisitos.length > 0) {
          for (const reqItem of comp.requisitos) {
            await neoSession.run(
              `MATCH (alvo:Disciplina {codigo: $alvo})
               MATCH (req:Disciplina {codigo: $req})
               MERGE (alvo)-[r:EXIGE_PRE_REQUISITO]->(req)
               SET r.tipo = $tipo;`,
              {
                alvo: comp.codigo,
                req: reqItem.disciplina_codigo,
                tipo: reqItem.tipo || 'E'
              }
            );
          }
        }
      }
      resultados.neo4j = true;
    } finally {
      await neoSession.close();
    }

    res.status(201).json({
      message: `Curso '${curso.nome}' (${curso.sigla}) cadastrado com sucesso em todos os 3 bancos de dados!`,
      resultados
    });
  } catch (err) {
    console.error('Erro ao cadastrar curso dinamicamente:', err);
    res.status(500).json({ error: err.message, status_parcial: resultados });
  }
});

app.listen(PORT, () => {
  console.log(`\n=====================================================`);
  console.log(`   🚀 Servidor PolyGrade Ativo em http://localhost:${PORT}`);
  console.log(`=====================================================\n`);
});
