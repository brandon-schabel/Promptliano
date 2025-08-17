# Error Handling Standards for GitHub Actions

This document defines standardized error handling patterns for all workflows in the Promptliano repository.

## 🎯 Error Handling Principles

### 1. **Fail Fast for Critical Operations**
Critical operations should fail the entire workflow immediately.

```yaml
- name: Run critical tests
  run: bun test
  continue-on-error: false  # Explicit (default behavior)
```

### 2. **Continue for Optional Operations**
Optional operations should not break the workflow.

```yaml
- name: Run optional linting
  run: bun run lint
  continue-on-error: true
```

### 3. **Always Run Cleanup and Summaries**
Cleanup and summary steps should always execute.

```yaml
- name: Generate summary
  if: always()
  run: echo "Summary"

- name: Cleanup resources
  if: always()
  run: docker system prune -f
```

### 4. **Conditional Failure for PR vs Main**
Some operations can be non-critical for PRs but critical for main branch.

```yaml
- name: Run tests
  run: bun test
  continue-on-error: ${{ github.event_name == 'pull_request' }}
```

## 🏗️ Standard Patterns

### Critical Test Steps
```yaml
- name: Run unit tests
  working-directory: packages/${{ matrix.package }}
  run: bun test
  continue-on-error: false

- name: Run type checking
  working-directory: packages/${{ matrix.package }}
  run: bun run typecheck
  continue-on-error: false
```

### Optional Quality Checks
```yaml
- name: Run linting
  working-directory: packages/${{ matrix.package }}
  run: bun run lint
  continue-on-error: true

- name: Run security audit
  run: bun audit
  continue-on-error: true
```

### Artifact Operations
```yaml
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: test-results/
  continue-on-error: true

- name: Upload coverage
  if: success() && inputs.generate-coverage
  uses: actions/upload-artifact@v4
  with:
    name: coverage
    path: coverage/
  continue-on-error: true
```

### External Service Operations
```yaml
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKER_HUB_USERNAME }}
    password: ${{ secrets.DOCKER_HUB_TOKEN }}
  continue-on-error: true  # Don't fail if credentials not set

- name: Publish to npm
  run: npm publish
  continue-on-error: ${{ github.event_name == 'pull_request' }}
```

### Summary and Cleanup Jobs
```yaml
workflow-summary:
  name: Workflow Summary
  if: always()
  needs: [test, build, deploy]
  runs-on: ubuntu-latest
  steps:
    - name: Generate summary
      run: echo "Workflow completed"
```

## 🚨 Error Handling Categories

### Category 1: Critical (MUST NOT continue-on-error)
- Unit tests
- Integration tests
- Type checking
- Security scans with HIGH/CRITICAL findings
- Build failures for production deployments

### Category 2: Important (conditional continue-on-error)
- End-to-end tests (continue for PRs, fail for main)
- Performance benchmarks (continue for PRs, fail for main)
- Publishing operations (continue for PRs, fail for releases)

### Category 3: Optional (SHOULD continue-on-error)
- Linting
- Code formatting checks
- Documentation generation
- Artifact uploads
- External service integrations
- Cleanup operations

### Category 4: Always Execute (MUST use if: always())
- Summary generation
- Resource cleanup
- Telemetry collection
- Error reporting
- Status updates

## 📋 Decision Matrix

| Operation Type | continue-on-error | if condition | Notes |
|---------------|-------------------|--------------|-------|
| Unit Tests | `false` | - | Critical for code quality |
| Type Checking | `false` | - | Critical for TypeScript projects |
| Linting | `true` | - | Optional quality check |
| Build (Production) | `false` | - | Critical for deployments |
| Build (Development) | `${{ github.event_name == 'pull_request' }}` | - | Conditional based on context |
| Artifact Upload | `true` | `always()` | Should not fail workflow |
| Summary Generation | `true` | `always()` | Always provide feedback |
| Cleanup | `true` | `always()` | Always clean up resources |
| External API Calls | `true` | - | Network operations can be flaky |
| Security Scans | `false` | - | Critical for security |
| Performance Tests | `${{ github.event_name == 'pull_request' }}` | - | Conditional based on context |

## 🔧 Implementation Examples

### Example 1: Package Testing Workflow
```yaml
- name: Run TypeScript validation
  working-directory: ${{ matrix.path }}
  run: bun run typecheck
  continue-on-error: false  # Critical

- name: Run unit tests
  working-directory: ${{ matrix.path }}
  run: bun test
  continue-on-error: false  # Critical

- name: Run linting
  working-directory: ${{ matrix.path }}
  run: bun run lint
  continue-on-error: true   # Optional

- name: Upload test artifacts
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: test-results/
  continue-on-error: true   # Should not fail workflow
```

### Example 2: Docker Build Workflow
```yaml
- name: Build Docker image
  uses: docker/build-push-action@v5
  with:
    push: false
  continue-on-error: false  # Critical

- name: Run security scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ steps.build.outputs.imageid }}
    exit-code: '1'
  continue-on-error: false  # Critical for security

- name: Upload to Docker Hub
  uses: docker/build-push-action@v5
  with:
    push: true
  continue-on-error: ${{ github.event_name == 'pull_request' }}  # Conditional
```

### Example 3: Summary Job
```yaml
summary:
  name: Workflow Summary
  if: always()
  needs: [test, build, security]
  runs-on: ubuntu-latest
  steps:
    - name: Collect results
      run: |
        echo "Tests: ${{ needs.test.result }}"
        echo "Build: ${{ needs.build.result }}"
        echo "Security: ${{ needs.security.result }}"
      continue-on-error: true  # Summary should not fail
```

## 🎯 Best Practices

1. **Be Explicit**: Always specify `continue-on-error` even when using defaults
2. **Document Decisions**: Comment why certain operations continue on error
3. **Use Telemetry**: Add the workflow-telemetry action for monitoring
4. **Test Error Paths**: Verify that error handling works as expected
5. **Monitor Patterns**: Review error patterns regularly and adjust standards

## 🚫 Anti-Patterns to Avoid

❌ **Don't use continue-on-error: true for critical tests**
```yaml
# BAD
- name: Run tests
  run: bun test
  continue-on-error: true  # Tests should fail the workflow!
```

❌ **Don't fail workflows on optional operations**
```yaml
# BAD
- name: Upload documentation
  run: upload-docs.sh
  continue-on-error: false  # Documentation upload shouldn't fail CI
```

❌ **Don't skip cleanup on failure**
```yaml
# BAD
- name: Cleanup
  run: cleanup.sh
  # Should use: if: always()
```

❌ **Don't ignore security scan failures**
```yaml
# BAD
- name: Security scan
  run: security-scanner
  continue-on-error: true  # Security issues should fail the workflow!
```

## 📊 Monitoring and Telemetry

Use the standardized telemetry action for monitoring:

```yaml
- name: Collect telemetry
  uses: ./.github/actions/workflow-telemetry
  with:
    step-name: "package-tests"
    step-type: "test"
    workflow-name: ${{ github.workflow }}
    package-name: ${{ matrix.package }}
    critical: true
```

This provides:
- Step timing data
- Success/failure rates
- Performance metrics
- Error categorization
- Trend analysis