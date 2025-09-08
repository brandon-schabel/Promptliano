# Process Management System Documentation

## Overview

The Promptliano Process Management System provides secure, monitored, and audited process execution capabilities. It's designed to safely run package.json scripts and system commands within sandboxed environments while enforcing comprehensive security policies and resource limits.

## Architecture Components

### Core Components

1. **Security Manager** (`security.ts`) - Command validation, sandboxing, and access control
2. **Resource Monitor** (`resource-monitor.ts`) - Real-time CPU/memory monitoring and enforcement
3. **Audit Logger** (`audit-logger.ts`) - Comprehensive security event logging and compliance
4. **Process Management Service** (`process-management-service.ts`) - Main orchestrator and API

### Key Features

- ✅ **Security-First Design** - Command allow-listing, path traversal protection, environment sanitization
- ✅ **Resource Monitoring** - Real-time CPU/memory monitoring with automatic process termination
- ✅ **Comprehensive Auditing** - Full security event logging with compliance reporting
- ✅ **Role-Based Access** - Different permissions for user/admin roles
- ✅ **Rate Limiting** - Per-user and per-project request throttling
- ✅ **Database Persistence** - Process runs, logs, and audit trails stored in SQLite
- ✅ **WebSocket Integration** - Real-time log streaming and process updates

## Security Model

### Command Validation

The system uses strict allow-listing of commands based on user roles:

```typescript
// Role-based command permissions
const commandPermissions = new Map([
  ['admin', new Set(['bun', 'npm', 'node', 'yarn', 'pnpm', 'git', 'python3'])],
  ['user', new Set(['bun', 'npm', 'yarn'])],
  ['system', new Set(['bun', 'npm', 'node', 'yarn', 'pnpm'])]
])
```

### Argument Validation

All command arguments are validated against security patterns:

```typescript
// Safe argument pattern
const SAFE_ARG_PATTERN = /^[\w@.\-+:=\/,\[\]"'\\]*$/

// Blocked dangerous patterns
const DANGEROUS_PATTERNS = [
  /\.\./,           // Path traversal
  /\/etc\//,        // System paths
  /\$\(/,          // Command substitution
  /&&|;|\|/,       // Command chaining
]
```

### Sandboxing

All processes run within a configured sandbox directory:

```typescript
// Default sandbox inference
function inferSandboxRoot(): string {
  // 1. Check PROCESS_SANDBOX_ROOT environment variable
  // 2. Detect monorepo structure and use root
  // 3. Fall back to current working directory
}
```

### Environment Variables

Environment variables are strictly filtered:

```typescript
// Allowed patterns
const ALLOWED_ENV_PATTERNS = [
  /^(NODE_|NPM_|YARN_|BUN_|PNPM_)/,
  /^(CI|PORT|HOME|USER|PATH|PWD)$/,
  /^(TERM|LANG|LC_)/
]

// Blocked patterns (security-sensitive)
const BLOCKED_ENV_PATTERNS = [
  /^(AWS_|GOOGLE_|AZURE_)/,  // Cloud credentials
  /^(DB_|DATABASE_)/,         // Database credentials
  /_SECRET|_KEY|_TOKEN$/,     // Any secrets/keys/tokens
]
```

## Resource Limits

### Default Limits by Role

| Role   | Memory | CPU Cores | Timeout | Max Args | Max Env Vars |
|--------|--------|-----------|---------|----------|--------------|
| User   | 512MB  | 2         | 5 min   | 20       | 50           |
| Admin  | 1GB    | 4         | 10 min  | 50       | 100          |
| System | 2GB    | 8         | 30 min  | 100      | 200          |

### Resource Monitoring

The system continuously monitors:

- **Memory Usage** - RSS and virtual memory
- **CPU Usage** - Per-core utilization percentage  
- **Process Count** - Number of threads and child processes
- **File Handles** - Open file descriptors
- **Network Connections** - Active network sockets

### Violation Handling

Resource violations trigger escalating responses:

1. **Warning** (1-2 violations) - Log and notify
2. **Throttling** (3-4 violations) - Reduce priority
3. **Termination** (5+ violations) - Kill process with SIGKILL

## Rate Limiting

### Per-User Limits

- **10 requests per minute** for process creation
- **5 concurrent processes** per user across all projects
- **Sliding window** rate limiting with automatic reset

### Per-Project Limits

- **5 concurrent processes** per project
- **100 process starts per hour** per project
- **Separate quotas** for different process types

### Implementation

```typescript
interface RateLimitConfig {
  windowMs: number      // Time window (default: 60000ms)
  maxRequests: number   // Max requests per window (default: 10)
  burstSize?: number    // Allow burst above limit (default: 2)
}
```

## Audit Logging

### Event Types

The system logs all security-relevant events:

- `PROCESS_START` / `PROCESS_STOP` / `PROCESS_KILL`
- `SECURITY_VIOLATION` / `COMMAND_BLOCKED`
- `RESOURCE_VIOLATION` / `RATE_LIMIT_EXCEEDED`
- `AUTHENTICATION_FAILURE` / `AUTHORIZATION_FAILURE`
- `PATH_TRAVERSAL_ATTEMPT` / `ENVIRONMENT_VIOLATION`

### Event Structure

```typescript
interface AuditEvent {
  id: string                    // Unique event ID
  timestamp: number             // Unix timestamp
  eventType: AuditEventType     // Event category
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  
  // Context
  userId?: string
  userRole?: string
  projectId: number
  clientIp?: string
  
  // Process details
  processId?: string
  command?: string[]
  
  // Security context
  violationReason?: string
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  
  // Outcome
  success: boolean
  actionTaken?: string
}
```

### Compliance Reporting

Generate compliance reports with:

```typescript
const report = await auditLogger.generateComplianceReport(
  projectId,
  { start: Date.now() - 86400000, end: Date.now() }
)

// Returns:
// - Compliance score (0-100%)
// - Security violations count
// - Risk level assessment
// - Improvement recommendations
```

## Configuration

### Environment Variables

```bash
# Security Configuration
PROCESS_SANDBOX_ROOT=/path/to/sandbox          # Sandbox directory
PROCESS_MAX_CONCURRENT=5                       # Max concurrent processes
PROCESS_DEFAULT_TIMEOUT=300000                 # Default timeout (5 min)

# Rate Limiting
PROCESS_RATE_LIMIT_WINDOW=60000               # Rate limit window (1 min)
PROCESS_RATE_LIMIT_MAX=10                     # Max requests per window
PROCESS_USER_CONCURRENT_LIMIT=10              # Max processes per user
PROCESS_PROJECT_CONCURRENT_LIMIT=5            # Max processes per project

# Resource Monitoring
PROCESS_MONITOR_INTERVAL=5000                 # Monitoring interval (5 sec)
PROCESS_VIOLATION_THRESHOLD=3                 # Violations before action
PROCESS_CRITICAL_THRESHOLD=5                  # Violations before termination

# Audit Logging
AUDIT_BUFFER_SIZE=1000                        # Event buffer size
AUDIT_FLUSH_INTERVAL=30000                    # Flush interval (30 sec)
AUDIT_PERSISTENCE_ENABLED=true                # Enable database persistence
```

### Role Configuration

```typescript
// Customize role permissions
const customSecurity = new ProcessSecurityManager()
customSecurity.setRolePermissions('developer', new Set([
  'bun', 'npm', 'yarn', 'node', 'python3', 'git'
]))

customSecurity.setRoleLimits('developer', {
  maxMemoryMB: 1024,
  maxCpuPercent: 300,  // 3 CPU cores
  maxTimeout: 600000,  // 10 minutes
  maxArgs: 30,
  maxEnvVars: 75
})
```

## Usage Examples

### Basic Process Execution

```typescript
import { createProcessManagementService } from '@promptliano/services'

const processService = createProcessManagementService()

// Start a process
const process = await processService.startProcess(projectId, {
  command: 'bun',
  args: ['run', 'build'],
  name: 'build-process',
  cwd: '/project/path'
})

console.log(`Started process ${process.id} with PID ${process.pid}`)
```

### Security Context

```typescript
import { processSecurityManager } from '@promptliano/services'

// Validate before execution
const securityContext = {
  userId: 'user123',
  userRole: 'user',
  projectId: 1,
  clientIp: '192.168.1.100'
}

const config = {
  command: ['bun', 'run', 'test'],
  projectId: 1,
  cwd: '/safe/project/path'
}

try {
  await processSecurityManager.validateProcessConfig(config, securityContext)
  // Proceed with execution
} catch (error) {
  // Handle security violation
  await processSecurityManager.auditProcessExecution(
    config, 
    securityContext, 
    'blocked', 
    error.message
  )
}
```

### Resource Monitoring

```typescript
import { processResourceMonitor } from '@promptliano/services'

// Start monitoring
processResourceMonitor.startMonitoring()

// Monitor a process
processResourceMonitor.monitorProcess('proc123', 12345, {
  maxMemoryMB: 512,
  maxCpuPercent: 200,  // 2 CPU cores
  maxThreads: 50
})

// Handle violations
processResourceMonitor.on('resource-termination-required', async (event) => {
  console.log(`Terminating process ${event.processId} due to ${event.reason}`)
  
  // Terminate the process
  await processService.stopProcess(event.projectId, event.processId)
  
  // Log the action
  await auditLogger.logResourceViolation(
    event.processId,
    event.projectId,
    securityContext,
    'memory',
    event.violations[0].currentUsage,
    event.violations[0].limit,
    'TERMINATED'
  )
})
```

### Audit Querying

```typescript
import { processAuditLogger } from '@promptliano/services'

// Query recent security violations
const { events } = await processAuditLogger.queryEvents({
  projectId: 1,
  eventType: ['SECURITY_VIOLATION', 'COMMAND_BLOCKED'],
  severity: ['ERROR', 'CRITICAL'],
  startTime: Date.now() - 86400000,  // Last 24 hours
  limit: 100
})

console.log(`Found ${events.length} security violations`)

// Generate compliance report
const report = await processAuditLogger.generateComplianceReport(1, {
  start: Date.now() - 30 * 86400000,  // Last 30 days
  end: Date.now()
})

console.log(`Compliance score: ${report.summary.complianceScore}%`)
console.log(`Security violations: ${report.summary.securityViolations}`)
console.log(`Risk level: ${report.summary.riskLevel}`)
```

## WebSocket Integration

### Real-Time Log Streaming

```typescript
// Server-side WebSocket handler
app.get('/ws/processes/:processId', websocket({
  message: (ws, message) => {
    const data = JSON.parse(message)
    
    if (data.type === 'subscribe-logs') {
      // Subscribe to process logs
      processService.on('log', (logEvent) => {
        if (logEvent.processId === data.processId) {
          ws.send(JSON.stringify({
            type: 'log',
            data: logEvent
          }))
        }
      })
    }
  }
}))
```

### Process Status Updates

```typescript
// Broadcast process status changes
processService.on('exit', (event) => {
  broadcast(`process:${event.processId}`, {
    type: 'process-exit',
    processId: event.processId,
    exitCode: event.exitCode,
    timestamp: Date.now()
  })
})
```

## Database Schema

### Process Runs

```sql
CREATE TABLE process_runs (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  process_id TEXT NOT NULL UNIQUE,
  pid INTEGER,
  name TEXT,
  command TEXT NOT NULL,
  args JSON,
  cwd TEXT,
  env JSON,
  status TEXT CHECK (status IN ('running', 'stopped', 'exited', 'error', 'killed')),
  started_at INTEGER NOT NULL,
  exited_at INTEGER,
  exit_code INTEGER,
  signal TEXT,
  cpu_usage REAL,
  memory_usage REAL,
  script_name TEXT,
  script_type TEXT DEFAULT 'bun',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Process Logs

```sql
CREATE TABLE process_logs (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES process_runs(id) ON DELETE CASCADE,
  timestamp INTEGER NOT NULL,
  type TEXT CHECK (type IN ('stdout', 'stderr', 'system')) NOT NULL,
  content TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

### Process Audit

```sql
CREATE TABLE process_audit (
  id INTEGER PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')) NOT NULL,
  user_id TEXT,
  user_role TEXT,
  project_id INTEGER NOT NULL,
  client_ip TEXT,
  user_agent TEXT,
  process_id TEXT,
  command JSON,
  working_directory TEXT,
  security_check TEXT,
  violation_reason TEXT,
  risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  resource_usage JSON,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  action_taken TEXT,
  metadata JSON,
  tags JSON,
  created_at INTEGER NOT NULL
);
```

## Troubleshooting

### Common Issues

1. **Command Blocked**
   ```
   Error: Command "git" not allowed for role user
   ```
   **Solution**: Grant appropriate role permissions or use allowed commands

2. **Sandbox Violation**
   ```
   Error: Working directory outside sandbox
   ```
   **Solution**: Ensure process cwd is within PROCESS_SANDBOX_ROOT

3. **Resource Limit Exceeded**
   ```
   Error: Process terminated due to memory violation
   ```
   **Solution**: Optimize process memory usage or request higher limits

4. **Rate Limit Hit**
   ```
   Error: Too many process requests from user
   ```
   **Solution**: Wait for rate limit window to reset or reduce request frequency

### Debug Commands

```bash
# Check current processes
curl localhost:3147/api/projects/1/processes

# View process logs
curl localhost:3147/api/projects/1/processes/proc123/logs

# Check audit events
curl 'localhost:3147/api/audit/events?severity=ERROR&limit=10'

# Monitor resource usage
curl localhost:3147/api/monitoring/processes/proc123/resources
```

### Log Analysis

```bash
# Search for security violations in application logs
grep "SECURITY_VIOLATION\|COMMAND_BLOCKED" logs/app.log

# Check resource violations
grep "RESOURCE_VIOLATION\|resource-termination-required" logs/app.log

# Monitor rate limiting
grep "RATE_LIMIT_EXCEEDED\|Too many" logs/app.log
```

## Best Practices

### Security

1. **Principle of Least Privilege** - Grant minimal necessary permissions
2. **Input Validation** - Validate all user inputs before processing  
3. **Audit Everything** - Log all security-relevant events
4. **Regular Review** - Periodically review audit logs and compliance reports
5. **Environment Isolation** - Use strict sandboxing and environment filtering

### Performance

1. **Resource Limits** - Set appropriate limits based on system capacity
2. **Monitoring** - Use real-time monitoring to detect issues early
3. **Cleanup** - Regularly clean up old process logs and audit records
4. **Optimization** - Profile and optimize frequently-used processes

### Operational

1. **Monitoring** - Set up alerts for security violations and resource issues
2. **Backup** - Regularly backup audit logs for compliance
3. **Testing** - Test security controls and resource limits regularly
4. **Documentation** - Keep security policies and procedures up to date

## Integration Testing

Run the comprehensive test suite:

```bash
# Unit tests
bun test packages/services/src/__tests__/process-*.test.ts

# Integration tests
bun test packages/services/src/__tests__/process-management-service.test.ts

# Security tests
bun test packages/services/src/__tests__/process-security.test.ts

# Resource monitoring tests  
bun test packages/services/src/__tests__/process-resource-monitor.test.ts
```

## Migration Guide

### From Legacy Process Management

1. **Update Dependencies**
   ```typescript
   // Old
   import { processManager } from './old-process-manager'
   
   // New
   import { createProcessManagementService } from '@promptliano/services'
   ```

2. **Security Configuration**
   ```typescript
   // Configure security policies
   const processService = createProcessManagementService({
     sandboxRoot: '/safe/project/root',
     maxConcurrent: 10
   })
   ```

3. **Migrate Existing Data**
   ```bash
   # Run database migration
   bun run db:migrate
   ```

This completes the comprehensive documentation for the Process Management System. The implementation provides enterprise-grade security, monitoring, and audit capabilities while maintaining ease of use for developers.