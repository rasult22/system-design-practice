#!/bin/bash
set -e
psql -U postgres -d postgres <<SQL
CREATE USER app WITH PASSWORD 'app' CREATEROLE CREATEDB;
CREATE DATABASE urlshortener OWNER app;
CREATE USER replicator WITH REPLICATION PASSWORD 'replicator';
SQL