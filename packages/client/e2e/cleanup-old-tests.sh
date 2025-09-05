#!/bin/bash

echo "🧹 Starting E2E Test Cleanup..."

# Backup first (optional)
echo "📦 Creating backup..."
mkdir -p /tmp/e2e-backup
cp -r . /tmp/e2e-backup/

# Remove old/duplicate prompt tests (keeping the most comprehensive one)
echo "🗑️  Removing duplicate prompt tests..."
rm -f tests/prompt-management-advanced.spec.ts
rm -f tests/prompt-management-comprehensive.spec.ts
rm -f tests/prompt-overview-panel.spec.ts
rm -f tests/prompt-workflow.spec.ts
# Keep: prompt-management-detailed.spec.ts, prompts.spec.ts, prompts-crud.spec.ts, prompts-integration.spec.ts, prompts-organization.spec.ts

# Remove old project tests (replaced by our new structure in tests/projects/)
echo "🗑️  Removing old project tests..."
rm -f tests/project-workflow.spec.ts
rm -f tests/projects-smoke.spec.ts
rm -f tests/projects.spec.ts

# Remove duplicate file tests (keep the most useful ones)
echo "🗑️  Removing duplicate file tests..."
rm -f tests/file-selection-workflow.spec.ts
rm -f tests/file-tree-detailed.spec.ts
# Keep: file-management.spec.ts, file-panel.spec.ts

# Remove other deprecated tests
echo "🗑️  Removing other deprecated tests..."
rm -f tests/user-input-panel.spec.ts  # UI component that may not exist
rm -f tests/flow-integration.spec.ts  # Duplicate of flow.spec.ts
rm -f tests/debug-projects.spec.ts    # Debug test, not needed

# Remove old test utilities that reference deleted files
echo "🗑️  Cleaning up utilities..."
rm -f utils/project-page-test-manager.ts 2>/dev/null

# Check for broken imports in remaining tests
echo "🔍 Checking for broken imports..."
BROKEN_FILES=""

# Files we know were deleted
DELETED_FILES=(
  "project-page-data"
  "chat-page-data"
  "project-page"
  "base.page"
  "project-context.page"
  "advanced-test-utilities"
  "comprehensive-test-utilities"
)

for file in tests/*.spec.ts; do
  for deleted in "${DELETED_FILES[@]}"; do
    if grep -q "$deleted" "$file" 2>/dev/null; then
      echo "⚠️  $file references deleted file: $deleted"
      BROKEN_FILES="$BROKEN_FILES $file"
    fi
  done
done

if [ -n "$BROKEN_FILES" ]; then
  echo "❌ Some tests reference deleted files. Please fix these imports:"
  echo "$BROKEN_FILES"
else
  echo "✅ No broken imports found"
fi

# Count remaining tests
TOTAL_TESTS=$(ls tests/*.spec.ts 2>/dev/null | wc -l)
TOTAL_PROJECTS=$(ls tests/projects/*.spec.ts 2>/dev/null | wc -l)
TOTAL_CHAT=$(ls tests/chat/*.spec.ts 2>/dev/null | wc -l)
TOTAL_PROVIDERS=$(ls tests/providers/*.spec.ts 2>/dev/null | wc -l)

echo ""
echo "📊 Test File Summary:"
echo "  Root tests: $TOTAL_TESTS"
echo "  Project tests: $TOTAL_PROJECTS"
echo "  Chat tests: $TOTAL_CHAT"
echo "  Provider tests: $TOTAL_PROVIDERS"
echo ""
echo "✅ Cleanup complete!"
echo "💡 Run 'npx playwright test --list' to verify all tests are still valid"