# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Queue Pilot, please report it through [GitHub Security Advisories](https://github.com/LarsCowe/queue-pilot/security/advisories/new).

**Do not** open a public issue for security vulnerabilities.

You should receive a response within 48 hours. We will work with you to understand the issue and coordinate a fix before public disclosure.

## Scope

Queue Pilot connects to message brokers (RabbitMQ, Kafka) using credentials provided by the user. Security concerns include:

- Credential handling and storage
- Message payload processing
- JSON Schema validation bypass
- MCP transport security
