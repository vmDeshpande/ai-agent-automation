# MCP Integration

This project supports Model Context Protocol (MCP) tools as first-class workflow steps.

The implementation lives in the backend and does three things:

1. Loads MCP server configuration from user settings and environment defaults.
2. Connects to MCP servers over `stdio` or `streamable-http`.
3. Exposes authenticated REST endpoints for discovery, health, and tool invocation.

## What is included

- MCP client framework in the backend
- `stdio` transport for local servers
- `streamable-http` transport for remote servers
- MCP settings in the UI
- Workflow builder support for an `mcp` step type
- Auth-protected MCP discovery and invoke APIs
- Demo `stdio` MCP server for local validation
- Step result metadata for MCP server and tool ids

## How configuration works

MCP can be configured in two places:

- User settings in the app under `Settings -> MCP Servers`
- Environment variables in `backend/.env`

At runtime, the backend merges both sources.

- Environment config acts as a shared/default source.
- User settings can add or override servers by `id`.
- Disabled servers are filtered out.
- MCP must be enabled globally and for the user before configured tools can run.

## Supported environment variables

Set these in `backend/.env`:

```env
MCP_ENABLED=false
MCP_CONFIG_PATH=
MCP_CONFIG_JSON=
MCP_SERVER_URL=
```

### Meaning

- `MCP_ENABLED`
  Turns MCP on or off globally for the backend. If this is `false`, MCP APIs will report MCP as disabled even if user settings contain servers.

- `MCP_CONFIG_PATH`
  Path to a JSON file containing MCP server definitions.

- `MCP_CONFIG_JSON`
  Inline JSON containing MCP server definitions.

- `MCP_SERVER_URL`
  Legacy shortcut for a single remote `streamable-http` server.

`MCP_CONFIG_JSON` and `MCP_CONFIG_PATH` may contain either:

```json
[
  {
    "id": "demo",
    "name": "Demo MCP Server",
    "transport": "stdio",
    "command": "node",
    "args": ["src/mcp/mockServers/stdio-demo.mjs"]
  }
]
```

or:

```json
{
  "servers": [
    {
      "id": "demo",
      "name": "Demo MCP Server",
      "transport": "stdio",
      "command": "node",
      "args": ["src/mcp/mockServers/stdio-demo.mjs"]
    }
  ]
}
```

## Supported server shapes

### `stdio` server

Use this for a local MCP server process started by the backend.

```json
{
  "id": "demo",
  "name": "Demo MCP Server",
  "transport": "stdio",
  "command": "node",
  "args": ["src/mcp/mockServers/stdio-demo.mjs"],
  "env": {
    "EXAMPLE_TOKEN": "value"
  },
  "enabled": true,
  "autoDiscover": true,
  "timeoutMs": 30000
}
```

Required fields:

- `id`
- `name`
- `transport: "stdio"`
- `command`

Optional fields:

- `args`
- `env`
- `enabled`
- `autoDiscover`
- `timeoutMs`

### `streamable-http` server

Use this for a remote MCP server exposed over HTTP.

```json
{
  "id": "remote-docs",
  "name": "Remote Docs Server",
  "transport": "streamable-http",
  "url": "http://localhost:3001/mcp",
  "headers": {
    "Authorization": "Bearer example-token"
  },
  "enabled": true,
  "autoDiscover": true,
  "timeoutMs": 30000
}
```

Required fields:

- `id`
- `name`
- `transport: "streamable-http"`
- `url`

Optional fields:

- `headers`
- `enabled`
- `autoDiscover`
- `timeoutMs`

`autoDiscover` is stored with the server config so the UI and future registry behavior can distinguish discovery intent. The current workflow builder discovers tools through `GET /api/mcp/tools`.

## Built-in local demo server

A demo MCP server is included in the repo:

`backend/src/mcp/mockServers/stdio-demo.mjs`

It exposes one tool:

- `echo`

Expected input:

```json
{
  "text": "hello",
  "taskId": "optional-id"
}
```

Expected output:

```json
{
  "content": [
    {
      "type": "text",
      "text": "echo:hello"
    }
  ],
  "structuredContent": {
    "echoed": "hello",
    "taskId": "optional-id"
  }
}
```

Important:

- Run the backend from the `backend/` directory.
- The demo server path is relative to that directory:
  `src/mcp/mockServers/stdio-demo.mjs`

## Example user settings payload

The backend stores MCP config inside system settings under `mcp`.

Example payload for `PUT /api/settings`:

```json
{
  "mcp": {
    "enabled": true,
    "servers": [
      {
        "id": "demo",
        "name": "Demo MCP Server",
        "transport": "stdio",
        "command": "node",
        "args": ["src/mcp/mockServers/stdio-demo.mjs"],
        "enabled": true,
        "autoDiscover": true,
        "timeoutMs": 30000
      }
    ]
  }
}
```

## Workflow step shape

Persisted MCP workflow steps use this shape:

```json
{
  "type": "mcp",
  "serverId": "demo",
  "toolName": "echo",
  "arguments": {
    "text": "{{last.output}}"
  },
  "timeoutMs": 30000
}
```

### Step field reference

- `type`
  Must be `"mcp"`.

- `serverId`
  The configured MCP server id.

- `toolName`
  The MCP tool to call on that server.

- `arguments`
  Object passed to the MCP tool.

- `timeoutMs`
  Optional override for per-call timeout.

During execution, MCP step results include:

- `serverId`
- `toolName`
- normalized `input.arguments`
- MCP response under `output`

Text content returned by MCP tools is also flattened into `output.text` when possible.

## API endpoints

All MCP endpoints are authenticated.

### `GET /api/mcp/servers`

Returns sanitized server configuration and cached health state.

Example response:

```json
{
  "ok": true,
  "enabled": true,
  "servers": [
    {
      "id": "demo",
      "name": "Demo MCP Server",
      "transport": "stdio",
      "enabled": true,
      "timeoutMs": 30000,
      "autoDiscover": true,
      "command": "node",
      "args": ["src/mcp/mockServers/stdio-demo.mjs"],
      "url": "",
      "source": "settings",
      "headers": {},
      "env": {},
      "health": {
        "healthy": true,
        "lastConnectedAt": "2026-06-05T10:00:00.000Z",
        "lastError": null,
        "lastErrorAt": null
      }
    }
  ]
}
```

### `GET /api/mcp/tools`

Discovers tools from configured MCP servers.

Example response:

```json
{
  "ok": true,
  "tools": [
    {
      "id": "demo:echo",
      "name": "echo",
      "description": "Echoes the provided text and metadata.",
      "inputSchema": {
        "type": "object"
      },
      "serverId": "demo",
      "serverName": "Demo MCP Server",
      "source": "mcp",
      "timeoutMs": 30000
    }
  ]
}
```

### `GET /api/mcp/health`

Returns a smaller health-oriented summary.

Example response:

```json
{
  "ok": true,
  "enabled": true,
  "servers": [
    {
      "id": "demo",
      "name": "Demo MCP Server",
      "transport": "stdio",
      "health": {
        "healthy": true,
        "lastConnectedAt": "2026-06-05T10:00:00.000Z",
        "lastError": null,
        "lastErrorAt": null
      }
    }
  ]
}
```

### `POST /api/mcp/tools/:serverId/:toolName/invoke`

Invokes an MCP tool.

Request body:

```json
{
  "arguments": {
    "text": "hello from api",
    "taskId": "manual-test-1"
  },
  "context": {},
  "timeoutMs": 30000
}
```

Example response:

```json
{
  "ok": true,
  "tool": {
    "id": "demo:echo",
    "name": "echo",
    "serverId": "demo"
  },
  "input": {
    "text": "hello from api",
    "taskId": "manual-test-1"
  },
  "output": {
    "content": [
      {
        "type": "text",
        "text": "echo:hello from api"
      }
    ],
    "structuredContent": {
      "echoed": "hello from api",
      "taskId": "manual-test-1"
    },
    "text": "echo:hello from api"
  }
}
```

## Verification

Run the static checks first, then use either the MCP smoke test or the full API test depending on how much of the stack you need to validate.

## Static verification

Run these before opening a PR:

```powershell
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

Then from the repo root:

```powershell
node -e "require('./backend/src/app'); console.log('backend app ok')"
node --check backend/src/mcp/mockServers/stdio-demo.mjs
```

Expected result:

- lint exits with code `0`; existing warnings may still be printed
- TypeScript exits with code `0`
- frontend production build completes
- backend app import prints `backend app ok`
- demo server syntax check exits with code `0`

On Windows, `next build` can fail if another process locks `.next/trace` or `.next/trace-build`. Stop any running Next dev server or delete the `.next` directory, then rerun `npm run build`.

## MCP smoke test without MongoDB

From the repo root, this validates discovery and invocation through the actual MCP client layer while stubbing the settings lookup:

```powershell
node -e "process.env.MCP_CONFIG_JSON=JSON.stringify({servers:[{id:'demo',name:'Demo',transport:'stdio',command:'node',args:['backend/src/mcp/mockServers/stdio-demo.mjs'],enabled:true}]}); const SystemSettings=require('./backend/src/models/systemSettings.model'); SystemSettings.findOne=()=>({lean:async()=>({mcp:{enabled:true,servers:[]}})}); const {listTools}=require('./backend/src/mcp/toolRegistry'); const {invokeTool}=require('./backend/src/mcp/executionAdapter'); const interpolate=(value,context)=>String(value).replace(/\{\{(.*?)\}\}/g,(_,key)=>context[key.trim()]||''); (async()=>{const tools=await listTools('user1'); console.log('tools', tools.map(t=>t.name).join(',')); const result=await invokeTool({userId:'user1',serverId:'demo',toolName:'echo',argumentsInput:{text:'hello',taskId:'{{taskId}}'},context:{taskId:'t1'},interpolate}); console.log('text', result.result.text); process.exit(0);})().catch((err)=>{console.error(err); process.exit(1);});"
```

Expected output:

```text
tools echo
text echo:hello
```

## End-to-end API test

Use this when you want to verify the database-backed settings flow and authenticated API routes.

### 1. Start MongoDB

From `infra/`:

```powershell
docker compose up -d mongo mongo-init-replica
```

### 2. Start the backend

From `backend/`:

```powershell
npm install
$env:MONGO_URI="mongodb://127.0.0.1:27017/ai-agent?replicaSet=rs0"
$env:JWT_SECRET="12345678901234567890123456789012"
$env:MCP_ENABLED="true"
npm start
```

Use `npm start`, not `npm run dev`.

### 3. Register or log in

If the test user does not exist yet, register it first:

```powershell
$registerBody = @{
  name = "MCP Test"
  email = "mcp-test@example.com"
  password = "Password123!"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:5000/api/auth/register" `
  -ContentType "application/json" `
  -Body $registerBody
```

Then log in:

```powershell
$loginBody = @{
  email = "mcp-test@example.com"
  password = "Password123!"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method Post `
  -Uri "http://localhost:5000/api/auth/login" `
  -ContentType "application/json" `
  -Body $loginBody

$token = $login.token
$headers = @{ Authorization = "Bearer $token" }
```

### 4. Save the demo MCP server in settings

```powershell
$settingsBody = @{
  mcp = @{
    enabled = $true
    servers = @(
      @{
        id = "demo"
        name = "Demo MCP Server"
        transport = "stdio"
        command = "node"
        args = @("src/mcp/mockServers/stdio-demo.mjs")
        enabled = $true
        autoDiscover = $true
        timeoutMs = 30000
      }
    )
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Put `
  -Uri "http://localhost:5000/api/settings" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $settingsBody
```

### 5. Verify discovery and health

```powershell
Invoke-RestMethod -Method Get `
  -Uri "http://localhost:5000/api/mcp/servers" `
  -Headers $headers

Invoke-RestMethod -Method Get `
  -Uri "http://localhost:5000/api/mcp/tools" `
  -Headers $headers

Invoke-RestMethod -Method Get `
  -Uri "http://localhost:5000/api/mcp/health" `
  -Headers $headers
```

Expected result:

- `/servers` returns the `demo` server
- `/tools` returns `echo`
- `/health` reports the `demo` server and its cached status

### 6. Invoke the demo tool

```powershell
$invokeBody = @{
  arguments = @{
    text = "hello from repo test"
    taskId = "manual-test-1"
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:5000/api/mcp/tools/demo/echo/invoke" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $invokeBody
```

Expected result:

- `ok` is `true`
- `output.text` is `echo:hello from repo test`
- `output.structuredContent.echoed` is `hello from repo test`

## Troubleshooting

### `MCP is disabled for this user`

Check both:

- backend env has `MCP_ENABLED=true`
- user settings have `mcp.enabled=true`

### `MCP server "<id>" is not configured`

The server was not saved under user settings, or the `serverId` in the workflow/API call does not match the configured `id`.

### `Failed to connect to MCP server`

For `stdio` servers, check:

- `command` exists on the machine
- `args` path is correct relative to the backend working directory
- the server process starts without crashing

For `streamable-http` servers, check:

- `url` is correct
- the server is reachable
- required auth headers are present

### Tools list is empty

Possible causes:

- server connected but does not expose tools
- discovery failed and was swallowed into an empty tool list
- wrong transport or wrong startup command

### `npm run dev` fails

This repo's backend dev script points to `src/server.js`, but the actual startup file is `backend/server.js`. Use `npm start` unless the dev script is corrected.

### Settings page shows save failure

The Settings UI checks the `PUT /api/settings` response before showing success. If saving fails, inspect the backend logs and confirm the server shape is valid:

- `stdio` servers need `id`, `name`, `transport`, and `command`
- `streamable-http` servers need `id`, `name`, `transport`, and `url`
- `timeoutMs` should be a positive number

## Notes

- MCP is provider-agnostic and separate from LLM provider selection.
- Secrets should stay environment-backed where possible.
- Deprecated SSE transport is intentionally not included in this implementation.
- The included demo server is intended for development verification only.
