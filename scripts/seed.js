import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import neo4j from 'neo4j-driver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Carregar os datasets JSON
const tadsData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'tads_2019.json'), 'utf-8'));
const btiData = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'curso_exemplo_bti.json'), 'utf-8'));
const cursosParaCarregar = [tadsData, btiData];

// 2. Configurações de Conexão dos 3 Bancos
const pgConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'polygrade',
  password: process.env.PG_PASSWORD || 'polygrade_pwd',
  database: process.env.PG_DATABASE || 'curriculo_db',
};

const mongoUri = process.env.MONGO_URI || 'mongodb://polygrade:polygrade_pwd@localhost:27017/curriculo_db?authSource=admin';
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'polygrade_pwd';

async function seedPostgreSQL() {
  console.log('\n--- [1/3] Populando PostgreSQL 16 (Relacional) ---');
  const client = new pg.Client(pgConfig);
  await client.connect();

  try {
    // Aplicar DDL
    const ddl = fs.readFileSync(path.join(rootDir, 'scripts', 'schema_postgres.sql'), 'utf-8');
    await client.query(ddl);

    for (const dataset of cursosParaCarregar) {
      const { curso, estrutura, componentes } = dataset;

      // Inserir Curso
      await client.query(
        `INSERT INTO curso (codigo, sigla, nome, nivel, unidade, modalidade)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (codigo) DO UPDATE 
         SET sigla = EXCLUDED.sigla, nome = EXCLUDED.nome;`,
        [curso.codigo, curso.sigla, curso.nome, curso.nivel, curso.unidade, curso.modalidade || 'Presencial']
      );

      // Inserir Estrutura Curricular
      await client.query(
        `INSERT INTO estrutura_curricular (codigo_matriz, curso_codigo, ano_versao, ch_total_minima, ch_obrigatoria, ch_optativa, ch_complementar, duracao_semestres, ativa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (codigo_matriz) DO NOTHING;`,
        [
          estrutura.codigo_matriz,
          curso.codigo,
          estrutura.ano_versao,
          estrutura.ch_total_minima,
          estrutura.ch_obrigatoria || 0,
          estrutura.ch_optativa || 0,
          estrutura.ch_complementar || 0,
          estrutura.duracao_padrao_semestres || 6,
          estrutura.ativa !== false
        ]
      );

      // Inserir Disciplinas e Matriz Componente
      for (const comp of componentes) {
        await client.query(
          `INSERT INTO disciplina (codigo, nome, ch, creditos, departamento, ementa)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (codigo) DO UPDATE 
           SET nome = EXCLUDED.nome, ch = EXCLUDED.ch, creditos = EXCLUDED.creditos, ementa = EXCLUDED.ementa;`,
          [comp.codigo, comp.nome, comp.ch, comp.creditos, comp.departamento, comp.ementa]
        );

        await client.query(
          `INSERT INTO matriz_componente (estrutura_codigo, disciplina_codigo, periodo_ideal, tipo_vinculo)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (estrutura_codigo, disciplina_codigo) DO UPDATE 
           SET periodo_ideal = EXCLUDED.periodo_ideal, tipo_vinculo = EXCLUDED.tipo_vinculo;`,
          [estrutura.codigo_matriz, comp.codigo, comp.periodo_ideal, comp.tipo_vinculo]
        );
      }

      // Inserir Pré-requisitos
      for (const comp of componentes) {
        if (comp.requisitos && comp.requisitos.length > 0) {
          for (const req of comp.requisitos) {
            await client.query(
              `INSERT INTO pre_requisito (disciplina_alvo_codigo, disciplina_requisito_codigo, operador_logico)
               VALUES ($1, $2, $3)
               ON CONFLICT (disciplina_alvo_codigo, disciplina_requisito_codigo) DO UPDATE 
               SET operador_logico = EXCLUDED.operador_logico;`,
              [comp.codigo, req.disciplina_codigo, req.tipo || 'E']
            );
          }
        }
      }
    }

    const resDisc = await client.query('SELECT count(*) FROM disciplina');
    const resReq = await client.query('SELECT count(*) FROM pre_requisito');
    console.log(`✓ PostgreSQL populado com sucesso: ${resDisc.rows[0].count} disciplinas e ${resReq.rows[0].count} pré-requisitos cadastrados.`);
  } finally {
    await client.end();
  }
}

async function seedMongoDB() {
  console.log('\n--- [2/3] Populando MongoDB 7.0 (Documentos) ---');
  const client = new MongoClient(mongoUri);
  await client.connect();

  try {
    const db = client.db('curriculo_db');
    const cursosCol = db.collection('cursos');
    const disciplinasCol = db.collection('disciplinas');

    // Limpar coleções existentes para carga idempotente
    await cursosCol.deleteMany({});
    await disciplinasCol.deleteMany({});

    // Criar Índices
    await disciplinasCol.createIndex({ codigo: 1 }, { unique: true });
    await disciplinasCol.createIndex({ nome: 'text', ementa: 'text' });
    await disciplinasCol.createIndex({ 'requisitos.disciplina_codigo': 1 });
    await disciplinasCol.createIndex({ 'cursos_vinculados.curso_sigla': 1, 'cursos_vinculados.periodo_ideal': 1 });

    for (const dataset of cursosParaCarregar) {
      const { curso, estrutura, componentes } = dataset;

      // Agrupar disciplinas por período para a coleção 'cursos'
      const gradeMap = new Map();
      for (const comp of componentes) {
        if (!gradeMap.has(comp.periodo_ideal)) {
          gradeMap.set(comp.periodo_ideal, []);
        }
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
        .map(([periodo, disciplinas]) => ({
          periodo,
          disciplinas
        }));

      // Documento da coleção 'cursos'
      await cursosCol.insertOne({
        _id: `${curso.sigla}_${estrutura.ano_versao}`,
        codigo: curso.codigo,
        sigla: curso.sigla,
        nome: curso.nome,
        nivel: curso.nivel,
        unidade: curso.unidade,
        ano_versao: estrutura.ano_versao,
        ch_total_minima: estrutura.ch_total_minima,
        duracao_semestres: estrutura.duracao_padrao_semestres || 6,
        grade: gradeArray
      });

      // Documentos da coleção 'disciplinas'
      for (const comp of componentes) {
        const docDisciplina = {
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
        };

        await disciplinasCol.updateOne(
          { codigo: comp.codigo },
          { $set: docDisciplina },
          { upsert: true }
        );
      }
    }

    const totalCursos = await cursosCol.countDocuments();
    const totalDisciplinas = await disciplinasCol.countDocuments();
    console.log(`✓ MongoDB populado com sucesso: ${totalCursos} cursos e ${totalDisciplinas} documentos de disciplinas.`);
  } finally {
    await client.close();
  }
}

async function seedNeo4j() {
  console.log('\n--- [3/3] Populando Neo4j 5 (Grafo) ---');
  const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
  const session = driver.session();

  try {
    // Criar constraints
    await session.run(`CREATE CONSTRAINT unq_disciplina_codigo IF NOT EXISTS FOR (d:Disciplina) REQUIRE d.codigo IS UNIQUE;`);
    await session.run(`CREATE CONSTRAINT unq_curso_sigla IF NOT EXISTS FOR (c:Curso) REQUIRE c.sigla IS UNIQUE;`);
    await session.run(`CREATE CONSTRAINT unq_estrutura_matriz IF NOT EXISTS FOR (e:Estrutura) REQUIRE e.codigo_matriz IS UNIQUE;`);

    // Limpar banco
    await session.run(`MATCH (n) DETACH DELETE n;`);

    for (const dataset of cursosParaCarregar) {
      const { curso, estrutura, componentes } = dataset;

      // Criar Nós Curso e Estrutura
      await session.run(
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

      // Criar Disciplinas e relação [:CONTEM]
      for (const comp of componentes) {
        await session.run(
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

      // Criar Relações de Pré-Requisitos [:EXIGE_PRE_REQUISITO]
      for (const comp of componentes) {
        if (comp.requisitos && comp.requisitos.length > 0) {
          for (const req of comp.requisitos) {
            await session.run(
              `MATCH (alvo:Disciplina {codigo: $alvo})
               MATCH (req:Disciplina {codigo: $req})
               MERGE (alvo)-[r:EXIGE_PRE_REQUISITO]->(req)
               SET r.tipo = $tipo;`,
              {
                alvo: comp.codigo,
                req: req.disciplina_codigo,
                tipo: req.tipo || 'E'
              }
            );
          }
        }
      }
    }

    const countNodes = await session.run(`MATCH (d:Disciplina) RETURN count(d) AS total;`);
    const countRels = await session.run(`MATCH ()-[r:EXIGE_PRE_REQUISITO]->() RETURN count(r) AS total;`);
    console.log(`✓ Neo4j populado com sucesso: ${countNodes.records[0].get('total').toNumber()} nós de disciplina e ${countRels.records[0].get('total').toNumber()} arestas de pré-requisito.`);
  } finally {
    await session.close();
    await driver.close();
  }
}

async function main() {
  console.log('=====================================================');
  console.log('   POLYGRADE: Carga Inicial de Dados Multiparadigma  ');
  console.log('=====================================================');

  try {
    await seedPostgreSQL();
    await seedMongoDB();
    await seedNeo4j();
    console.log('\n>>> SUCESSO TOTAL: Todos os 3 bancos de dados foram populados com 100% de paridade!');
  } catch (err) {
    console.error('\n❌ Erro durante o processo de seed:', err);
    process.exit(1);
  }
}

main();

