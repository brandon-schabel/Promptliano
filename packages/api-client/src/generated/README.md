# Auto-Generated API Client

⚠️ **DO NOT EDIT FILES IN THIS DIRECTORY MANUALLY**

This directory contains automatically generated TypeScript API clients based on the server's OpenAPI specification.

## 🔄 Regeneration

To regenerate the client:

```bash
cd packages/api-client
bun run generate:all
```

## 📁 Generated Files

- `api-types.ts` - TypeScript types from OpenAPI
- `type-safe-client.ts` - Fetch-based type-safe client
- `advanced-hooks.ts` - Advanced React Query hooks with factory features
- `react-query-provider.tsx` - Provider component
- `index.ts` - Main exports

## ✨ Features

The generated hooks include advanced features via the CRUD factory:
- ✅ Optimistic updates
- ✅ Smart caching & invalidation
- ✅ Error handling with toasts
- ✅ Batch operations
- ✅ Prefetching strategies
- ✅ Infinite queries

## 📖 Documentation

- `../GENERATED_CLIENT_GUIDE.md` - Usage examples and API reference
- `../HOOK_DUPLICATION_SOLUTION.md` - Technical details on architecture
- `../CLEANUP_SUMMARY.md` - Files removed during cleanup
