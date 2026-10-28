import pg from 'pg';
import { MongoClient } from 'mongodb';
import neo4j from 'neo4j-driver';

const pgClient = new pg.Client({
  host: 'localhost',
  port: 5432,
  user: 'polygrade',
  password: 'polygrade_pwd',
  database: 'curriculo_db'
});

const mongoClient = new MongoClient('mongodb://polygrade:polygrade_pwd@localhost:27017/curriculo_db?authSource=admin');
const neo4jDriver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'polygrade_pwd'));

async function testAll() {
  console.log('=== TESTE DE CONSULTAS FÍSICAS NOS 3 BANCOS DE DADOS ===\n');

  // 1. PostgreSQL
  await pgClient.connect();
  const t0_pg = process.hrtime.bigint();
  const pgRes = await pgClient.query(`
    WITH RECURSIVE arvore AS (
        SELECT pr.disciplina_alvo_codigo, pr.disciplina_requisito_codigo, pr.operador_logico, 1 AS nivel
        FROM pre_requisito pr
        WHERE pr.disciplina_alvo_codigo = 'TAD0157'
        UNION ALL
        SELECT pr_prox.disciplina_alvo_codigo, pr_prox.disciplina_requisito_codigo, pr_prox.operador_logico, a.nivel + 1
        FROM pre_requisito pr_prox
        JOIN arvore a ON pr_prox.disciplina_alvo_codigo = a.disciplina_requisito_codigo
    )
    SELECT DISTINCT d.codigo, d.nome, a.nivel, a.operador_logico
    FROM arvore a
    JOIN disciplina d ON d.codigo = a.disciplina_requisito_codigo
    ORDER BY a.nivel, d.codigo;
  `);
  const t1_pg = process.hrtime.bigint();
  const pgTimeMs = Number(t1_pg - t0_pg) / 1_000_000;
  console.log(`[PostgreSQL] CTE Recursivo (TAD0157): ${pgRes.rows.length} requisitos encontrados em ${pgTimeMs.toFixed(3)} ms`);
  console.table(pgRes.rows.slice(0, 5));
  await pgClient.end();

  // 2. MongoDB
  await mongoClient.connect();
  const db = mongoClient.db('curriculo_db');
  const t0_mongo = process.hrtime.bigint();
  const mongoRes = await db.collection('disciplinas').aggregate([
    { $match: { codigo: 'TAD0157' } },
    {
      $graphLookup: {
        from: 'disciplinas',
        startWith: '$requisitos.disciplina_codigo',
        connectFromField: 'requisitos.disciplina_codigo',
        connectToField: 'codigo',
        as: 'cadeia',
        maxDepth: 5,
        depthField: 'nivel'
      }
    },
    { $project: { codigo: 1, nome: 1, 'cadeia.codigo': 1, 'cadeia.nome': 1, 'cadeia.nivel': 1 } }
  ]).toArray();
  const t1_mongo = process.hrtime.bigint();
  const mongoTimeMs = Number(t1_mongo - t0_mongo) / 1_000_000;
  const mongoCadeia = mongoRes[0]?.cadeia || [];
  console.log(`\n[MongoDB] $graphLookup (TAD0157): ${mongoCadeia.length} requisitos encontrados em ${mongoTimeMs.toFixed(3)} ms`);
  console.table(mongoCadeia.slice(0, 5));
  await mongoClient.close();

  // 3. Neo4j
  const neoSession = neo4jDriver.session();
  const t0_neo = process.hrtime.bigint();
  const neoRes = await neoSession.run(`
    MATCH caminho = (alvo:Disciplina {codigo: 'TAD0157'})-[:EXIGE_PRE_REQUISITO*1..]->(req:Disciplina)
    RETURN DISTINCT req.codigo AS codigo, req.nome AS nome, length(caminho) AS nivel
    ORDER BY nivel, codigo;
  `);
  const t1_neo = process.hrtime.bigint();
  const neoTimeMs = Number(t1_neo - t0_neo) / 1_000_000;
  const neoRecords = neoRes.records.map(r => ({
    codigo: r.get('codigo'),
    nome: r.get('nome'),
    nivel: r.get('nivel').toNumber()
  }));
  console.log(`\n[Neo4j] Cypher Path Traversal (TAD0157): ${neoRecords.length} requisitos encontrados em ${neoTimeMs.toFixed(3)} ms`);
  console.table(neoRecords.slice(0, 5));
  await neoSession.close();
  await neo4jDriver.close();

  console.log('\n>>> BENCHMARK COMPARATIVO PRELIMINAR (Consulta Recursiva TAD0157):');
  console.log(`- PostgreSQL (CTE):       ${pgTimeMs.toFixed(3)} ms`);
  console.log(`- MongoDB ($graphLookup):  ${mongoTimeMs.toFixed(3)} ms`);
  console.log(`- Neo4j (Cypher *1..):    ${neoTimeMs.toFixed(3)} ms`);
}

testAll().catch(console.error);

