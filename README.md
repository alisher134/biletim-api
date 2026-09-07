# tarih-api

NestJS API with JWT authentication, user profiles, and PostgreSQL via Prisma.

## Stack

- NestJS 11
- PostgreSQL 16
- Prisma 7
- JWT access + refresh tokens
- argon2 password hashing

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Start PostgreSQL:

```bash
npm run db:up
```

3. Install dependencies and run migrations:

```bash
npm install
npm run prisma:migrate
```

4. Start the API:

```bash
npm run start:dev
```

The server listens on `PORT` from `.env` (default `8080`).

## Environment variables

| Variable | Description |
| --- | --- |
| `PORT` | HTTP port for the API |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Secret for access tokens |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime, e.g. `15m` |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime, e.g. `7d` |
| `CORS_ORIGIN` | Allowed frontend origin |

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/sign-up` | No | Register a user |
| `POST` | `/auth/sign-in` | No | Sign in and receive tokens |
| `POST` | `/auth/refresh` | No | Refresh access token |
| `GET` | `/auth/me` | Bearer | Get current user profile |
| `PATCH` | `/users/me` | Bearer | Update first and last name |
| `PATCH` | `/users/me/password` | Bearer | Change password |

## Scripts

```bash
npm run start:dev   # development with watch mode
npm run build       # compile TypeScript
npm run lint        # check lint errors
npm run lint:fix    # auto-fix lint issues
npm test            # unit tests
npm run test:e2e    # end-to-end tests
npm run test:cov    # coverage report
npm run db:up       # start PostgreSQL in Docker
npm run db:down     # stop PostgreSQL
npm run prisma:migrate
npm run prisma:studio
```

## Testing

Unit tests mock Prisma and external services. E2E tests boot the full application and require a running PostgreSQL instance configured in `.env`.

```bash
npm test
npm run test:e2e
```

## Project structure

```text
src/
  auth/          # sign-up, sign-in, refresh, JWT guard/strategy
  users/         # profile update and password change
  prisma/        # PrismaService wrapper
  generated/     # generated Prisma client (do not edit)
test/
  auth/
    auth.e2e-spec.ts
  users/
    users.e2e-spec.ts
  helpers/
    app.ts
    auth.ts
prisma/
  schema.prisma
  migrations/
```
