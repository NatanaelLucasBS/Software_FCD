-- Schema DDL para PostgreSQL 16
-- Projeto PolyGrade - Persistência Poliglota de Estrutura Curricular

CREATE TABLE IF NOT EXISTS curso (
    codigo VARCHAR(10) PRIMARY KEY,
    sigla VARCHAR(20) NOT NULL UNIQUE,
    nome VARCHAR(150) NOT NULL,
    nivel VARCHAR(50) NOT NULL,
    unidade VARCHAR(120) NOT NULL,
    modalidade VARCHAR(30) NOT NULL DEFAULT 'Presencial'
);

CREATE TABLE IF NOT EXISTS estrutura_curricular (
    codigo_matriz VARCHAR(20) PRIMARY KEY,
    curso_codigo VARCHAR(10) NOT NULL REFERENCES curso(codigo) ON DELETE CASCADE,
    ano_versao INTEGER NOT NULL,
    ch_total_minima INTEGER NOT NULL,
    ch_obrigatoria INTEGER NOT NULL,
    ch_optativa INTEGER NOT NULL,
    ch_complementar INTEGER NOT NULL,
    duracao_semestres INTEGER NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS disciplina (
    codigo VARCHAR(10) PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    ch INTEGER NOT NULL,
    creditos INTEGER NOT NULL,
    departamento VARCHAR(30) NOT NULL,
    ementa TEXT
);

CREATE TABLE IF NOT EXISTS matriz_componente (
    id SERIAL PRIMARY KEY,
    estrutura_codigo VARCHAR(20) NOT NULL REFERENCES estrutura_curricular(codigo_matriz) ON DELETE CASCADE,
    disciplina_codigo VARCHAR(10) NOT NULL REFERENCES disciplina(codigo) ON DELETE CASCADE,
    periodo_ideal INTEGER NOT NULL,
    tipo_vinculo VARCHAR(30) NOT NULL DEFAULT 'OBRIGATORIA',
    CONSTRAINT unq_estrutura_disciplina UNIQUE (estrutura_codigo, disciplina_codigo)
);

CREATE TABLE IF NOT EXISTS pre_requisito (
    id SERIAL PRIMARY KEY,
    disciplina_alvo_codigo VARCHAR(10) NOT NULL REFERENCES disciplina(codigo) ON DELETE CASCADE,
    disciplina_requisito_codigo VARCHAR(10) NOT NULL REFERENCES disciplina(codigo) ON DELETE CASCADE,
    operador_logico VARCHAR(5) NOT NULL DEFAULT 'E', -- 'E' ou 'OU'
    CONSTRAINT unq_pre_requisito UNIQUE (disciplina_alvo_codigo, disciplina_requisito_codigo)
);

-- Índices para otimização de leitura e travessia
CREATE INDEX IF NOT EXISTS idx_matriz_estrutura_periodo ON matriz_componente(estrutura_codigo, periodo_ideal);
CREATE INDEX IF NOT EXISTS idx_disciplina_nome ON disciplina(nome);
CREATE INDEX IF NOT EXISTS idx_pre_requisito_alvo ON pre_requisito(disciplina_alvo_codigo);
CREATE INDEX IF NOT EXISTS idx_pre_requisito_origem ON pre_requisito(disciplina_requisito_codigo);

