# Changelog

## [0.3.0] — 2026-02-13

### Added
- `create_exchange` tool — create exchanges with type/durable/auto_delete options
- `delete_queue` tool — delete a queue
- `delete_exchange` tool — delete an exchange
- `delete_binding` tool — delete a binding by exchange/queue/properties_key
- `get_overview` tool — cluster overview with version info, message rates, object totals
- `check_health` tool — broker health check (returns ok/failed without throwing on 503)
- `get_queue` tool — detailed queue info including consumers, memory, message stats
- `list_consumers` tool — list consumers with queue, tag, connection, prefetch details
- `list_connections` tool — list client connections with user, state, channel count
- MCP Resources — each loaded schema exposed as a readable `schema:///` resource
- MCP Prompts — `debug-flow`, `health-report`, `schema-compliance` workflow templates
- `OverviewResponse`, `HealthCheckResponse`, `QueueDetail`, `ConsumerInfo`, `ConnectionInfo` types
- `properties_key` field added to `BindingInfo` and `list_bindings` output

### Changed
- Tool count increased from 12 to 21

## [0.2.4] — 2026-02-13

### Fixed
- CLI `parseArgs` no longer silently consumes flags as values when a preceding flag is missing its argument
- `SchemaValidator` constructor catches `addSchema` errors instead of leaving partial initialization
- `response.text()` failure in RabbitMQ error handler no longer masks HTTP status context
- `loadSchemas` eliminates TOCTOU race by removing redundant `access()` pre-check

### Added
- `encodeVhost` rejects empty string to prevent silent API endpoint misrouting
- `loadSchemas` now recurses into subdirectories for hierarchical schema organization

## [0.2.3] — 2026-02-13

### Changed
- Improved TypeScript strictness with `noUncheckedIndexedAccess` and safer array indexing
- Extracted `jsonResponse` helper to eliminate duplication in server request handling
- Replaced `any`-typed Ajv import with typed `AjvInstance` interface
- Changed `GetSchemaResult` to discriminated union for proper type narrowing
- Extracted shared test fixtures for canonical order and payment schemas
- Added CI matrix for Windows alongside Ubuntu
- Added integration test and publish workflows with RabbitMQ service containers
- Source maps now resolve for consumers (src/ included in package)
- Added `clean` script to remove stale build artifacts

### Added
- Shared test fixtures module (`test-fixtures.ts`)
- Error propagation tests for list-queues, peek-messages, list-exchanges, list-bindings
- RabbitMQ tool wiring tests for server
- CLI argument parsing tests for `--rabbitmq-url/user/pass` overrides

### Removed
- Orphaned eslint-disable comments from validator
- Unused globals and path alias from vitest config

## [0.2.2] — 2026-02-13

### Fixed
- `purgeQueue` now reads actual message count from DELETE response instead of fabricating it
- Error responses now include RabbitMQ response body for better debugging
- `inspect_queue` reports "Invalid JSON payload" instead of confusing schema errors for non-JSON messages
- Base64 payload encoding is now detected and handled correctly
- Entry-point detection works correctly on Windows and with npm symlinks
- Fatal error handler preserves stack traces

### Changed
- RabbitMQ credentials can now be set via environment variables (`RABBITMQ_URL`, `RABBITMQ_USER`, `RABBITMQ_PASS`)
- `headers` parameter constrained to JSON-serializable types (string, number, boolean, null)
- `SchemaDefinition` interface now correctly marks `title`, `description`, `version` as optional
- `inspect_queue` now includes `content_type` and `payload_encoding` in output
- `peek_messages` now includes `payload_encoding` in output
- Package version reading deduplicated into shared module
- Removed redundant type annotation in validate-message
- Strengthened wiring test assertions
- Integration test cleanup and assertion improvements
- CI workflow now cancels superseded runs with concurrency groups

### Removed
- Stale test count from README
- Accidental `nul` entry from .gitignore

## [0.2.1] — 2026-02-13

### Fixed
- Corrected bin path in package.json for npm global installs

### Changed
- Added npm version and license badges to README

## [0.2.0] — 2026-02-13

### Added
- `publish_message` tool — publish to exchange with optional schema validation gate
- `purge_queue` tool — remove all messages from a queue
- `create_queue` tool — create queue with durable/auto_delete options
- `create_binding` tool — bind queue to exchange with routing key
- Integration tests for write operations
- `PublishMessageBody`, `PublishResponse`, `PurgeResponse` types

### Fixed
- `purge_queue` now handles RabbitMQ 4's 204 No Content response correctly

### Changed
- Extracted `rawRequest` in RabbitMQ client (internal refactor)
- README updated with write tool docs and examples

## [0.1.2] — 2026-02-13

### Fixed
- Read version from package.json for --version flag
- Resolved pre-publish issues for npm readiness

## [0.1.0] — 2026-02-13

### Added
- Initial release with 8 read-only MCP tools
- JSON Schema loading and validation (Ajv)
- RabbitMQ Management API integration
- `list_queues`, `peek_messages`, `inspect_queue`
- `list_exchanges`, `list_bindings`
- `list_schemas`, `get_schema`, `validate_message`
