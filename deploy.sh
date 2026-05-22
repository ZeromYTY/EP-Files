#!/bin/sh
set -eu

cd "$(dirname "$0")"
git pull origin master
docker compose up -d --build
docker compose ps
