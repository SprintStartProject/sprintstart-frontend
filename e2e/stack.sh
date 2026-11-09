#!/usr/bin/env bash
# Starts or stops the end-to-end stack: sprintstart-backend's compose file with
# e2e/compose.e2e.yaml on top. BACKEND_DIR points at a checkout of sprintstart-backend
# (default: ../sprintstart-backend next to this repository).
#
#   bash e2e/stack.sh up      # start and wait until backend and Keycloak answer
#   bash e2e/stack.sh down    # stop and delete everything, volumes included
#   bash e2e/stack.sh logs    # follow the logs
#   bash e2e/stack.sh dump    # print the last 200 lines of every service (for CI)

set -euo pipefail

E2E_DIR=$(cd "$(dirname "$0")" && pwd)
BACKEND_DIR=$(cd "${BACKEND_DIR:-$E2E_DIR/../../sprintstart-backend}" && pwd)
export E2E_DIR

compose() {
    docker compose -p sprintstart-e2e --project-directory "$BACKEND_DIR" \
        -f "$BACKEND_DIR/docker-compose.yaml" -f "$E2E_DIR/compose.e2e.yaml" \
        --env-file "$E2E_DIR/stack.env" "$@"
}

wait_for() {
    local name=$1 url=$2
    for _ in $(seq 1 90); do
        curl -fs -o /dev/null "$url" && { echo "e2e: $name is up"; return; }
        sleep 2
    done
    echo "e2e: $name did not come up at $url"
    compose logs --tail 80
    exit 1
}

case "${1:-up}" in
    up)
        compose up -d
        wait_for keycloak http://localhost:8081/auth/realms/sprintstart/.well-known/openid-configuration
        wait_for backend http://localhost:8080/api/v1/health
        ;;
    down) compose down -v ;;
    logs) compose logs -f ;;
    dump) compose logs --tail 200 ;;
    *) echo "usage: e2e/stack.sh up|down|logs|dump"; exit 2 ;;
esac
