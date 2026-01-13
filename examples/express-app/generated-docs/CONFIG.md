# Configuration Reference

## server

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `server.host` | string | No | `"localhost"` | - |
| `server.port` | number | No | `3000` | - |

## database

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `database.url` | string | Yes | - | - |
| `database.poolSize` | number | No | `10` | - |
| `database.ssl` | boolean | No | `false` | - |

## redis

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `redis.host` | string | No | `"localhost"` | - |
| `redis.port` | number | No | `6379` | - |
| `redis.password` | string | No | - | - |

## auth

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.jwtSecret` | string | Yes | - | - |
| `auth.jwtExpiresIn` | string | No | `"7d"` | - |
| `auth.bcryptRounds` | number | No | `12` | - |

## features

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `features.enableCache` | boolean | No | `true` | - |
| `features.enableRateLimit` | boolean | No | `true` | - |
| `features.maxRequestsPerMinute` | number | No | `100` | - |

## logging

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `logging.level` | enum(debug, info, warn, error) | No | `"info"` | - |
| `logging.format` | enum(json, pretty) | No | `"json"` | - |
