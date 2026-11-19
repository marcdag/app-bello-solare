#!/usr/bin/env bash
# Uso: PGHOST=... PGPORT=... ./rodar_testes.sh   (Postgres 15+ local, usuário com permissão para criar bancos)
set -euo pipefail
cd "$(dirname "$0")"
P="psql -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists bello_teste" -c "create database bello_teste"
for f in 00_simula_supabase.sql ../migrations/*.sql 01_fluxos.sql; do $P -d bello_teste -f "$f"; done
