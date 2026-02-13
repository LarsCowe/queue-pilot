# Changelog

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
