#!/usr/bin/env bash
# Script para pausar ou parar os três containers locais

echo "Parando containers do PolyGrade..."
docker stop polygrade_postgres polygrade_mongodb polygrade_neo4j 2>/dev/null || true
echo "Containers parados com sucesso."

