#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="s7-mock"
CONTAINER_NAME="s7-mock"

docker build -t "${IMAGE_NAME}" .

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
fi

docker run -d --name "${CONTAINER_NAME}" -p 1102:1102 "${IMAGE_NAME}"

docker ps --filter "name=${CONTAINER_NAME}"

