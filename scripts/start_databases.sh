#!/usr/bin/env bash
# Script para iniciar os três bancos de dados locais com recursos padronizados
# Projeto PolyGrade - Persistência Poliglota

set -e

NETWORK="polygrade_net"
if ! docker network ls | grep -q "$NETWORK"; then
    echo "Criando rede docker: $NETWORK..."
    docker network create "$NETWORK"
fi

echo "=== 1. Iniciando PostgreSQL 16 (Relacional) ==="
if [ "$(docker ps -aq -f name=polygrade_postgres)" ]; then
    echo "Container polygrade_postgres já existe. Iniciando..."
    docker start polygrade_postgres
else
    docker run -d \
        --name polygrade_postgres \
        --network "$NETWORK" \
        -p 5432:5432 \
        -e POSTGRES_USER=polygrade \
        -e POSTGRES_PASSWORD=polygrade_pwd \
        -e POSTGRES_DB=curriculo_db \
        --cpus="1.0" \
        --memory="1024m" \
        --restart unless-stopped \
        -v polygrade_pgdata:/var/lib/postgresql/data \
        postgres:16-alpine
fi

echo "=== 2. Iniciando MongoDB 7.0 (Documentos) ==="
if [ "$(docker ps -aq -f name=polygrade_mongodb)" ]; then
    echo "Container polygrade_mongodb já existe. Iniciando..."
    docker start polygrade_mongodb
else
    docker run -d \
        --name polygrade_mongodb \
        --network "$NETWORK" \
        -p 27017:27017 \
        -e MONGO_INITDB_ROOT_USERNAME=polygrade \
        -e MONGO_INITDB_ROOT_PASSWORD=polygrade_pwd \
        -e MONGO_INITDB_DATABASE=curriculo_db \
        --cpus="1.0" \
        --memory="1024m" \
        --restart unless-stopped \
        -v polygrade_mongodata:/data/db \
        mongo:7.0
fi

echo "=== 3. Iniciando Neo4j 5 Community (Grafo) ==="
if [ "$(docker ps -aq -f name=polygrade_neo4j)" ]; then
    echo "Container polygrade_neo4j já existe. Iniciando..."
    docker start polygrade_neo4j
else
    docker run -d \
        --name polygrade_neo4j \
        --network "$NETWORK" \
        -p 7474:7474 \
        -p 7687:7687 \
        -e NEO4J_AUTH=neo4j/polygrade_pwd \
        -e NEO4J_PLUGINS='["apoc"]' \
        -e NEO4J_dbms_security_procedures_unrestricted=apoc.* \
        --cpus="1.0" \
        --memory="1024m" \
        --restart unless-stopped \
        -v polygrade_neo4jdata:/data \
        neo4j:5-community
fi

echo ""
echo "Todos os 3 containers foram configurados e iniciados com sucesso!"
echo "- PostgreSQL: porta 5432 (User: polygrade, DB: curriculo_db)"
echo "- MongoDB:    porta 27017 (User: polygrade, DB: curriculo_db)"
echo "- Neo4j:      porta 7474 (HTTP) e 7687 (Bolt) (User: neo4j)"

