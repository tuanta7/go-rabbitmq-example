ENV_FILE ?= $(CURDIR)/.env
ENV_PATH := $(abspath $(ENV_FILE))

.PHONY: start-scheduler start-worker

start-scheduler:
	@test -f "$(ENV_PATH)" || { echo "Environment file not found: $(ENV_PATH)" >&2; exit 1; }
	cd scheduler && ENV_FILE="$(ENV_PATH)" go run ./cmd

start-worker:
	@test -f "$(ENV_PATH)" || { echo "Environment file not found: $(ENV_PATH)" >&2; exit 1; }
	cd worker && node --env-file="$(ENV_PATH)" src/index.js
