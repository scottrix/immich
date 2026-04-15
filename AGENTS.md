# AGENTS.md

This file provides guidance for AI coding agents working in the Immich codebase.

## Project Overview

Immich is a self-hosted photo and video backup solution. It's a monorepo containing:
- **server/**: NestJS backend (TypeScript)
- **web/**: SvelteKit frontend (TypeScript/Svelte)
- **mobile/**: Flutter mobile app (Dart)
- **machine-learning/**: Python ML microservice
- **cli/**: Node.js CLI tool
- **e2e/**: End-to-end tests (Playwright)

## Build Commands

### Server
```bash
cd server
pnpm install                 # Install dependencies
pnpm run build              # Build the server
pnpm run start:dev          # Development mode with watch
pnpm run start:debug        # Debug mode (port 9230)
```

### Web
```bash
cd web
pnpm install                 # Install dependencies
pnpm run dev                # Development server (port 3000)
pnpm run build              # Production build
```

### Docker
```bash
podman build -t immich-local -f server/Dockerfile .   # Build Docker image
```

## Test Commands

### Server Unit Tests
```bash
cd server
pnpm run test                        # Run all tests
pnpm run test src/services/partner.service.spec.ts  # Run single test file
pnpm run test:cov                    # Run with coverage
```

### Web Tests
```bash
cd web
pnpm run test                        # Run all tests
pnpm run test:cov                    # Run with coverage
```

### E2E Tests
```bash
make e2e                    # Start test environment
cd e2e && pnpm test         # Run e2e tests
```

## Lint/Format Commands

### Server
```bash
cd server
pnpm run format             # Check formatting
pnpm run format:fix         # Fix formatting
pnpm run lint               # Run ESLint
pnpm run lint:fix           # Fix lint issues
pnpm run check              # TypeScript type check
pnpm run check:code         # Format + lint + type check
```

### Web
```bash
cd web
pnpm run format             # Check formatting
pnpm run format:fix         # Fix formatting
pnpm run lint               # Run ESLint
pnpm run lint:fix           # Fix lint issues
pnpm run check:code         # Format + lint + svelte-check + tsc
```

## Code Style Guidelines

### General
- Use TypeScript for all server and web code
- Use `pnpm` as package manager (version >= 10.0.0)
- Follow existing naming conventions in the surrounding code
- Keep PRs focused - one thing per PR

### Server (NestJS)
- **DTOs**: Use Zod schemas with `createZodDto` for validation (not class-validator)
- **Services**: Business logic goes in `src/services/`
- **Repositories**: Database/filesystem operations go in `src/repositories/` - keep them simple, no Immich-specific logic
- **Controllers**: HTTP handlers in `src/controllers/`
- **Migrations**: Use `pnpm run migrations:create` for new migrations

#### Example DTO (Zod-based)
```typescript
const PartnerUpdateSchema = z
  .object({
    inTimeline: z.boolean().optional().describe('Show partner assets in timeline'),
    shareAllAlbums: z.boolean().optional().describe('Share all albums with partner'),
  })
  .meta({ id: 'PartnerUpdateDto' });

export class PartnerUpdateDto extends createZodDto(PartnerUpdateSchema) {}
```

#### Example Service Test
```typescript
describe(PartnerService.name, () => {
  let sut: PartnerService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PartnerService));
  });

  it('should work', () => {
    expect(sut).toBeDefined();
  });
});
```

### Web (SvelteKit)
- Svelte 5 with runes (`$state`, `$derived`, etc.)
- Use `@immich/sdk` for API calls (auto-generated from OpenAPI)
- Components in `src/lib/components/`
- Routes in `src/routes/`

### Imports
- Use path aliases: `src/` prefix for imports
- Example: `import { PartnerService } from 'src/services/partner.service';`

### Error Handling
- Use NestJS built-in exceptions: `BadRequestException`, `NotFoundException`, etc.
- Throw descriptive error messages

### Naming Conventions
- Files: `kebab-case.ts` (e.g., `partner.service.ts`)
- Classes: `PascalCase` (e.g., `PartnerService`)
- Interfaces: `PascalCase` with `I` prefix optional
- Variables/functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE` for true constants, `camelCase` for config objects

## Database Migrations

Migrations are handled via `@immich/sql-tools`:

```bash
cd server
pnpm run migrations:create   # Create new migration
pnpm run migrations:generate # Generate migration from schema changes
pnpm run migrations:run      # Run pending migrations
pnpm run migrations:revert   # Revert last migration
```

Migration files go in `server/src/schema/migrations/` with format:
`{timestamp}-{description}.ts`

## OpenAPI/SDK Sync

After changing API endpoints, regenerate the SDK:

```bash
make open-api               # From project root
```

This updates:
- OpenAPI spec
- TypeScript SDK (`open-api/typescript-sdk/`)
- API documentation

## Key Files

- `server/src/database.ts` - Database types and Kysely schema
- `server/src/enum.ts` - Application enums
- `server/src/dtos/` - Data transfer objects
- `server/src/services/` - Business logic
- `server/src/repositories/` - Database operations
- `web/src/lib/components/` - UI components
- `web/src/routes/` - Page routes

## Testing Patterns

### Service Test Structure
```typescript
import { newTestService, ServiceMocks } from 'test/utils';
import { Factory } from 'test/factories';

describe(ServiceName.name, () => {
  let sut: ServiceName;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(ServiceName));
  });

  describe('methodName', () => {
    it('should do something', async () => {
      mocks.repo.method.mockResolvedValue(data);
      await expect(sut.method()).resolves.toBeDefined();
      expect(mocks.repo.method).toHaveBeenCalledWith(args);
    });
  });
});
```

### Running Single Tests
```bash
pnpm run test -- --grep "test name pattern"
pnpm run test path/to/test.spec.ts
```

## Important Notes

- DO NOT add comments unless explicitly asked
- Keep changes minimal and focused
- Follow existing patterns in the codebase
- Run `pnpm run check:code` before committing
- All code in services uses repositories for database calls
- Repositories should be basic/simple, no business logic
