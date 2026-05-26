#!/bin/sh
set -eu

cd "$(dirname "$0")"
git fetch origin
git checkout master
git pull --ff-only origin master
docker compose up -d --build --remove-orphans
docker compose ps
