# Contributing to THE WAY

Welcome! Here's how to set up your development environment and contribute.

## Setup

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

### Folder Structure

```
src/
├── app/
│  ├── api/          # API routes (organized by domain)
│  ├── client/       # Client dashboard
│  ├── coach/        # Coach dashboard
│  └── page.tsx      # Landing page
├── components/      # Reusable React components
├── hooks/           # Custom React hooks (extracted logic)
│  ├── useAuth.ts
│  ├── client/       # Client-specific hooks
│  └── coach/        # Coach-specific hooks
└── lib/
   ├── api.ts        # Centralized API wrapper
   ├── auth.ts       # Auth utilities
   ├── db.ts         # Database connection
   ├── types.ts      # TypeScript types
   └── constants.ts  # Magic values & endpoints
```

### Adding a Feature

1. **Create a hook** in `src/hooks/` if logic is reusable
   ```typescript
   // src/hooks/useMyFeature.ts
   export function useMyFeature() {
     const [state, setState] = useState(...);
     // logic
     return { state, ... };
   }
   ```

2. **Create/Update API route** in `src/app/api/{domain}/`
   ```typescript
   // src/app/api/foods/new-endpoint/route.ts
   export async function POST(req: NextRequest) {
     // implementation
   }
   ```

3. **Add tests** in `src/__tests__/`
   ```bash
   npm test -- --testPathPattern="myFeature"
   ```

4. **Use in component**
   ```tsx
   import { useMyFeature } from "@/hooks";
   
   export function MyComponent() {
     const { state } = useMyFeature();
     return <div>{state}</div>;
   }
   ```

## Code Standards

### TypeScript
- ✅ Strict mode enabled (no `any`)
- ✅ Full type annotations
- ✅ Use interfaces for data shapes

### Naming
- Hooks: `useFeatureName.ts`
- Components: `PascalCase.tsx`
- Files: `camelCase.ts`
- Functions: `camelCase()`

### Styling
- ✅ Tailwind CSS (no inline styles)
- ✅ Hebrew RTL-first approach
- ✅ Use design tokens from `src/lib/design-system.ts`

### Comments
- Only add comments for the "why", not the "what"
- Function names should explain what the code does
- Avoid multi-line comment blocks

## API Routes

All routes should:
1. ✅ Check auth with `getSessionUser()`
2. ✅ Validate input
3. ✅ Initialize DB with `initDb()` if needed
4. ✅ Return JSON with proper status codes
5. ✅ Include error handling

Example:
```typescript
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  await initDb();
  
  try {
    const body = await req.json();
    // validation & processing
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Run specific test
npm test -- --testPathPattern="useAuth"
```

Write tests for:
- ✅ API routes (request/response)
- ✅ Custom hooks (state changes)
- ✅ Complex components (user interaction)

## Commits

Use conventional commits:
```
feat: add water tracking to home tab
fix: correct API parameter names for quotes endpoint
refactor: extract hooks from client page
docs: update API reference
test: add tests for useFoodTracking hook
```

## Before Pushing

```bash
# Check types
npm run build

# Run all tests
npm test

# Lint
npm run lint
```

## Deploy

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md)

## Questions?

- Check [API.md](./docs/API.md) for endpoint documentation
- Review [DESIGN_ACCESSIBILITY_SUMMARY.md](./docs/DESIGN_ACCESSIBILITY_SUMMARY.md) for UI guidelines
- Look at existing code for patterns

Welcome! 🚀
