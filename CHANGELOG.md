# Changelog

## [0.2.0] — 2026-02-13

### Added
- `publish_message` tool — publish to exchange with optional schema validation gate
- `purge_queue` tool — remove all messages from a queue
- `create_queue` tool — create queue with durable/auto_delete options
- `create_binding` tool — bind queue to exchange with routing key
- Integration tests for write operations
- `PublishMessageBody`, `PublishResponse`, `PurgeResponse` types

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
