# devbox web

copy env:

```bash
cp .env.example .env
```

required:

```bash
E2B_API_KEY=
GITHUB_TOKEN=
```

install:

```bash
bun install
bun run gen
bun run db:migrate:local
```

web app:

```bash
bun run dev
bun run dev:cf
bun run build
bun run preview
```

deploy:

```bash
wrangler deploy
```

db:

```bash
bun run db:generate
bun run db:migrate:local
bun run db:migrate:remote
```

template admin:

```bash
bun run build:template:dev
bun run sandbox:create
bun run sandbox:list
bun run sandbox:ssh <sandbox-id>
```
