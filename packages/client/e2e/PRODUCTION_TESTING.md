# E2E Production Testing Configuration

## Overview

This document describes the production-like E2E testing setup that builds the client before running tests, ensuring tests run against production-built code rather than the development server.

## Configuration Files

### 1. `playwright-production.config.ts`
- **Purpose**: Main production testing configuration
- **Features**:
  - Builds client before starting tests
  - Serves built files from `server/client-dist`
  - Uses port 53147 for testing isolation
  - Includes all browser configurations

### 2. `playwright-ci-production.config.ts`
- **Purpose**: CI-optimized configuration
- **Features**:
  - Assumes client is already built (for CI pipelines)
  - Reduced browser matrix (Chromium only by default)
  - GitHub Actions reporter integration
  - Minimal logging for CI environments

### 3. `global-setup-production.ts`
- **Purpose**: Pre-test setup for production testing
- **Features**:
  - Builds client automatically
  - Verifies build output exists
  - Sets up test database
  - Initializes test project infrastructure

## How It Works

### Build Process

1. **Client Build**: 
   - TypeScript compilation: `tsc -b tsconfig.app.json`
   - Vite build: `vite build`
   - Output: `../server/client-dist/`

2. **Server Configuration**:
   - Serves static files from `client-dist`
   - Uses test database: `playwright-test.db`
   - Runs on port 53147 for isolation

3. **Test Execution**:
   - Tests run against built application
   - Full browser matrix support
   - Parallel test execution with sharding

## Usage

### Local Development

```bash
# Run tests with production build
bun run test:e2e:build

# Run with UI mode for debugging
bun run test:e2e:build:ui

# Run in headed mode (visible browser)
bun run test:e2e:build:headed

# Debug specific tests
bun run test:e2e:build:debug
```

### Continuous Integration

```bash
# Build client first
bun run build:client

# Then run tests (uses pre-built client)
bun run test:e2e:ci:production
```

### Command Comparison

| Command | Mode | Build | Server | Use Case |
|---------|------|-------|--------|----------|
| `test:e2e` | Dev | No | Dev server (51420) | Quick iteration during development |
| `test:e2e:build` | Prod | Yes | Built files (53147) | Production-like testing |
| `test:e2e:ci:production` | Prod | No* | Built files (53147) | CI/CD pipelines |

*Assumes build is done separately in CI

## Benefits

1. **Production Parity**: Tests run against the same code that deploys to production
2. **Performance**: Built code is optimized and minified, revealing real performance
3. **Build Verification**: Catches build-time issues before deployment
4. **Asset Testing**: Verifies static asset serving and bundling
5. **CI Integration**: Supports both local and CI testing workflows

## Architecture

```
┌─────────────────┐
│   Build Phase   │
├─────────────────┤
│ TypeScript      │──> Compile
│ Vite            │──> Bundle
│ Output          │──> server/client-dist/
└─────────────────┘
        ↓
┌─────────────────┐
│  Server Phase   │
├─────────────────┤
│ Bun Server      │──> Port 53147
│ Static Serving  │──> client-dist/
│ API Routes      │──> /api/*
└─────────────────┘
        ↓
┌─────────────────┐
│   Test Phase    │
├─────────────────┤
│ Playwright      │──> Browser automation
│ Test Database   │──> Isolated data
│ Assertions      │──> Verify behavior
└─────────────────┘
```

## Environment Variables

```bash
# Test server configuration
PORT=53147                    # Test server port
DATABASE_PATH=playwright-test.db  # Test database
NODE_ENV=e2e                 # Environment mode

# Client configuration
VITE_BASE_URL=http://localhost:53147  # App URL
VITE_API_URL=http://localhost:53147/api  # API URL
```

## Troubleshooting

### Build Failures

If the build fails due to TypeScript errors:

1. Fix TypeScript errors: `bun run typecheck`
2. Or bypass for testing: `bunx vite build --mode production`

### Port Conflicts

If port 53147 is in use:

1. Check running processes: `lsof -i :53147`
2. Kill process: `kill -9 <PID>`
3. Or change port in config files

### Test Timeouts

For slow builds or startup:

1. Increase timeout in config: `timeout: 240 * 1000`
2. Check system resources
3. Consider using dev mode for faster iteration

## Best Practices

1. **Always test production builds** before releases
2. **Run quick dev tests** during development
3. **Use CI production config** in pipelines
4. **Monitor build times** and optimize as needed
5. **Keep test database clean** between runs

## Migration from Dev-Only Testing

### Before (Dev Server Only)
- Tests ran against unoptimized code
- Different behavior from production
- Missed build-time issues

### After (Production + Dev Options)
- Choice of dev or production testing
- Catches build and optimization issues
- True production parity

## Future Improvements

1. **Incremental Builds**: Only rebuild changed files
2. **Build Caching**: Cache builds between test runs
3. **Parallel Building**: Build and test in parallel
4. **Asset Optimization**: Pre-compress static assets
5. **Docker Integration**: Test in production-like containers