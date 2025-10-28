# Repository Guidelines

## Project Structure & Module Organization

Single TypeScript library with database-driven state machine architecture:

```
supabase-workflow-engine/
├── src/
│   ├── engine/          # Core workflow orchestration
│   ├── state/           # State management and transitions
│   ├── actions/         # Workflow action handlers
│   ├── events/          # Event handling and triggers
│   └── types/           # TypeScript type definitions
├── supabase/
│   └── migrations/      # Database schema and functions
├── examples/            # Workflow examples (email, notifications)
└── docs/                # Architecture documentation
```

**Database-First Architecture:** Business logic lives in PostgreSQL functions and triggers.

## Build, Test, and Development Commands

```bash
# Build and development
npm run dev              # Watch mode with tsup
npm run build            # Production build (ESM + CJS)
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint with TypeScript
npm run lint:fix         # Auto-fix linting issues
npm run format           # Prettier formatting
npm run format:check     # Check formatting

# Testing
npm run test             # Run Vitest tests
npm run test:watch       # Watch mode for tests
npm run test:coverage    # Generate coverage report

# Database operations (requires Supabase CLI)
npm run db:reset         # Reset local database
npm run db:migrate       # Apply migrations
npm run db:generate-types # Generate TypeScript types from schema

# Run examples
npm run example:email    # Email workflow example
```

## Coding Style & Naming Conventions

**TypeScript:**
- **ESLint:** Strict TypeScript rules with `@typescript-eslint`
- **Prettier:** Automatic code formatting
- **Interfaces/Types:** PascalCase (`WorkflowConfig`, `StateTransition`, `ActionHandler`)
- **Functions:** camelCase (`executeWorkflow()`, `transitionState()`, `handleEvent()`)
- **Files:** kebab-case (`workflow-engine.ts`, `state-machine.ts`)
- **Zod Schemas:** PascalCase with `Schema` suffix (`WorkflowConfigSchema`)

**SQL (PL/pgSQL):**
- Functions: snake_case (`execute_workflow()`, `transition_state()`)
- Tables: snake_case plural (`workflows`, `workflow_executions`, `workflow_events`)
- Triggers: snake_case with `_trigger` suffix (`on_state_change_trigger`)

## Testing Guidelines

**Framework:** Vitest 1.1.0

**Running Tests:**
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Generate coverage report
```

**Test Structure:**
- Test files: `*.test.ts` alongside source files
- Focus on: State transitions, workflow validation, event handling
- Mock database calls or use in-memory test database
- Test error scenarios and edge cases

**Coverage Target:** Aim for > 80% coverage on core engine logic.

## Commit & Pull Request Guidelines

**Commit Format:** Conventional Commits

```
feat(engine): add conditional branching support
feat(state): implement parallel state execution
fix(events): resolve race condition in event handling
perf(db): optimize workflow query performance
docs(examples): add approval workflow example
test(state): add edge case tests for transitions
```

**Scopes:** `engine`, `state`, `actions`, `events`, `db`, `migrations`, `examples`, `docs`

**PR Requirements:**
- Link related issues
- Include migration files for database schema changes
- Update type definitions if schema changes
- Add/update tests for new functionality
- Ensure all checks pass (`lint`, `typecheck`, `test`)
- Update documentation for API changes

## Database Setup & Migrations

**Prerequisites:**
1. Supabase project with PostgreSQL 15+
2. Supabase CLI installed locally

**Initial Setup:**
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize local development
supabase start

# Apply migrations
supabase migration up

# Generate TypeScript types from schema
npm run db:generate-types
```

**Migration Workflow:**
```bash
# Create new migration
supabase migration new add_feature_name

# Apply locally
supabase migration up

# Test migration
npm run test

# Push to remote (after testing)
supabase db push
```

**Database Functions:**
- All workflow logic in PL/pgSQL functions
- Use transactions for state transitions
- Implement idempotency checks
- Add proper error handling and logging

## Architecture & State Machine Patterns

**Core Concepts:**
- **Workflows:** Define state graph and transitions
- **Executions:** Individual workflow runs with state tracking
- **Events:** Trigger state transitions or actions
- **Actions:** Business logic executed during transitions

**State Machine:**
```typescript
{
  states: ['pending', 'processing', 'completed', 'failed'],
  transitions: [
    { from: 'pending', to: 'processing', event: 'start' },
    { from: 'processing', to: 'completed', event: 'finish' },
    { from: 'processing', to: 'failed', event: 'error' }
  ]
}
```

**Event-Driven Architecture:**
- Database triggers emit events on state changes
- Realtime subscriptions for live updates
- Webhook notifications for external integrations

**Validation:**
- Zod schemas for runtime validation
- Type-safe database operations via generated types
- Validate state transitions before execution

## Environment Setup

**Required:**
- Node.js >= 18.0.0
- Supabase project
- Supabase CLI

**Environment Variables:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For admin operations
```

**Development Workflow:**
1. Start Supabase locally: `supabase start`
2. Apply migrations: `npm run db:migrate`
3. Generate types: `npm run db:generate-types`
4. Run in watch mode: `npm run dev`
5. Test changes: `npm run test`
