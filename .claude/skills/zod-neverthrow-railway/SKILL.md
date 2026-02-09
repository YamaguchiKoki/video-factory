---
name: zod-neverthrow-railway
description: Zod validation with neverthrow for railway-oriented programming. Use when building error-safe validation pipelines, converting Zod errors to Result types, or implementing functional error handling patterns that avoid throwing exceptions.
---

# Zod + neverthrow Railway Programming

Transform Zod validation into Result types for railway-oriented programming patterns.

## When to Apply

- Converting Zod's safeParse results to neverthrow Result types
- Building validation pipelines that never throw
- Chaining transformations with early error returns
- Creating functional error handling patterns

## Critical Rules

**Use safeParse, never parse**: Always use `.safeParse()` to avoid exceptions

```ts
// WRONG - throws on validation failure
const data = schema.parse(input);

// RIGHT - returns discriminated union
const result = schema.safeParse(input);
```

**Convert to Result immediately**: Transform Zod results to neverthrow Results at boundaries

```ts
// WRONG - working with Zod result directly
if (!zodResult.success) {
  // handle error logic scattered throughout code
}

// RIGHT - convert to Result type immediately  
const toResult = <T>(zodResult: SafeParseReturnType<unknown, T>) =>
  zodResult.success ? ok(zodResult.data) : err(zodResult.error);
```

## Key Patterns

### Basic Validation Pipeline

```ts
import { z } from 'zod';
import { Result, ok, err } from 'neverthrow';

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18)
});

const validateUser = (input: unknown): Result<User, z.ZodError> => {
  const result = UserSchema.safeParse(input);
  return result.success ? ok(result.data) : err(result.error);
};

// Chain with other operations
validateUser(input)
  .andThen(user => saveUser(user))
  .andThen(user => sendWelcomeEmail(user))
  .match(
    user => console.log('Success:', user),
    error => console.error('Failed:', error)
  );
```

### Transform with Validation

```ts
const StringToNumber = z.string().transform((val, ctx) => {
  const parsed = Number.parseFloat(val);
  if (Number.isNaN(parsed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid number format"
    });
    return z.NEVER;
  }
  return parsed;
});

const parseNumber = (input: string): Result<number, z.ZodError> => {
  const result = StringToNumber.safeParse(input);
  return result.success ? ok(result.data) : err(result.error);
};
```

### Async Validation Pipeline

```ts
const AsyncUserSchema = z.object({
  username: z.string().transform(async (username) => {
    const exists = await checkUsernameExists(username);
    if (exists) throw new Error('Username taken');
    return username;
  })
});

const validateUserAsync = async (input: unknown): Promise<Result<User, z.ZodError>> => {
  const result = await AsyncUserSchema.safeParseAsync(input);
  return result.success ? ok(result.data) : err(result.error);
};

// Use with ResultAsync
const processUser = (input: unknown) =>
  ResultAsync.fromPromise(
    validateUserAsync(input),
    (error) => new Error('Validation failed')
  )
  .andThen(result => result) // unwrap inner Result
  .andThen(user => saveUserAsync(user));
```

### Discriminated Union Results

```ts
const ApiResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success'), data: z.string() }),
  z.object({ status: z.literal('error'), error: z.string() })
]);

const parseApiResponse = (input: unknown): Result<ApiResponse, z.ZodError> => {
  const result = ApiResponseSchema.safeParse(input);
  return result.success ? ok(result.data) : err(result.error);
};

// Handle both validation errors and API errors
parseApiResponse(response)
  .andThen(apiResult => 
    apiResult.status === 'success' 
      ? ok(apiResult.data)
      : err(new Error(apiResult.error))
  )
  .match(
    data => processSuccess(data),
    error => handleError(error)
  );
```

### Error Aggregation

```ts
const validateMultipleInputs = (inputs: unknown[]): Result<User[], z.ZodError[]> => {
  const results = inputs.map(input => UserSchema.safeParse(input));
  
  const successes = results
    .filter((r): r is z.SafeParseSuccess<User> => r.success)
    .map(r => r.data);
    
  const errors = results
    .filter((r): r is z.SafeParseError<unknown> => !r.success)
    .map(r => r.error);
    
  return errors.length > 0 ? err(errors) : ok(successes);
};
```

## Common Mistakes

- **Using .parse() instead of .safeParse()** — Breaks railway pattern with exceptions
- **Not converting Zod results immediately** — Leads to mixed error handling patterns  
- **Forgetting .safeParseAsync() for async schemas** — Use with transforms/refinements containing async operations
- **Ignoring z.NEVER in transforms** — Use for early returns without affecting types