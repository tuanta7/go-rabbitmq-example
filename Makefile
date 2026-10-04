ENV_FILE ?= $(CURDIR)/.env
ENV_PATH := $(shell realpath -q "$(ENV_FILE)")
-include $(ENV_FILE)

DOCKER_MIGRATE = docker run --rm --network host -v $(CURDIR)/scheduler/migrations:/migrations migrate/migrate:v4.18.1

.PHONY: start-scheduler start-worker migrate-up migrate-down

start-scheduler:
	@test -f "$(ENV_PATH)" || { echo "Environment file not found: $(ENV_FILE)" >&2; exit 1; }
	cd scheduler && ENV_FILE="$(ENV_PATH)" go run ./cmd

start-worker:
	@test -f "$(ENV_PATH)" || { echo "Environment file not found: $(ENV_FILE)" >&2; exit 1; }
	cd worker && node --env-file="$(ENV_PATH)" src/index.js

migrate-up:
	@test -f "$(ENV_PATH)" || { echo "Environment file not found: $(ENV_FILE)" >&2; exit 1; }
	@test -n '$(POSTGRES_URL)' || { echo "POSTGRES_URL is required in $(ENV_FILE)" >&2; exit 1; }
	$(DOCKER_MIGRATE) -path=/migrations -database '$(POSTGRES_URL)' up

migrate-down:
	@test -f "$(ENV_PATH)" || { echo "Environment file not found: $(ENV_FILE)" >&2; exit 1; }
	@test -n '$(POSTGRES_URL)' || { echo "POSTGRES_URL is required in $(ENV_FILE)" >&2; exit 1; }
	$(DOCKER_MIGRATE) -path=/migrations -database '$(POSTGRES_URL)' down 1
