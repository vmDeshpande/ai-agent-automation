# AGENTS.md

## Repo Structure

Monorepo with three packages that are NOT linked via workspaces — each has its own `node_modules`:

- `backend/` — Node.js/Express, **CommonJS** (`"type": "commonjs"`), entry point `server.js`
- `frontend/` — Next.js 16 + React 19 + TypeScript, entry point `src/app/`
- `infra/` — Docker Compose stack (MongoDB, backend, worker, frontend, nginx)

## Dev Commands

**Backend** (two processes required):

```bash
cd backend
cp .env.example .env   # fill in JWT_SECRET, MONGO_URI, LLM keys
npm install
npm run dev             # API server on :5000
npm run worker          # agent runner (separate terminal)
```

**Frontend**:

```bash
cd frontend
npm install
npm run dev             # Next.js on :3000
```

**Lint & format** (run from repo root):

```bash
npm run lint            # eslint frontend/src + backend/src
npm run format          # prettier --write frontend/src backend/src
```

**Backend tests**:

```bash
cd backend
npm test                # runs jest --testMatch '**/*.handler.test.js'
```

Only handler test files are included. There is no frontend test suite.

## Git Hooks

Husky runs on commit:

- **pre-commit**: `lint-staged` → eslint --fix + prettier --write on staged files
- **commit-msg**: commitlint enforces [Conventional Commits](https://www.conventionalcommits.org/)

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Header max 100 chars, subject lowercase, no trailing period.

## Code Style

- **Backend JS**: `prefer-const`, `eqeqeq`, no `var`, no `throw literal`, no `return await`
- **Frontend TS**: `@typescript-eslint/consistent-type-imports` enforced, `no-explicit-any` as warning, React hooks rules enforced
- **Prettier**: semi, singleQuote, tabWidth 2, trailingComma es5, printWidth 100, bracketSpacing, arrowParens always

## Architecture Notes

- Backend and frontend are separate processes communicating over REST + MongoDB
- MongoDB must run with **replica set** enabled (Docker compose handles this via `mongo-init-replica`)
- Worker (`npm run worker` / `node src/agents/runner.js`) polls for tasks — must run alongside the API server
- `backend/src/` layout: `agents/`, `config/`, `controllers/`, `models/`, `routes/`, `services/`, `tools/`, `workflow/`
- Frontend API URL in Docker is derived from `BACKEND_PORT` — do NOT set `NEXT_PUBLIC_API_URL` manually for Docker deploys
- Env vars are never committed; `backend/.env.example` is the source of truth for local dev, `infra/.env.example` for Docker

## Architecture & Topic Guide

Deep docs live in `docs/`. By topic:

- **Workflow engine architecture** — [docs/architecture.md](docs/architecture.md), [docs/workflow-engine.md](docs/workflow-engine.md)
- **Runner & executor flow** — [docs/workflow-engine.md](docs/workflow-engine.md) (execution lifecycle + step flow); worker entry `backend/src/agents/runner.js`
- **Workflow graph / edge routing** — [docs/workflow-builder.md](docs/workflow-builder.md), [docs/architecture.md](docs/architecture.md) (branch routing)
- **Agent memory system** — [docs/semantic-memory.md](docs/semantic-memory.md), [docs/agent-system.md](docs/agent-system.md)
- **Document RAG** — [docs/document-intelligence-rag.md](docs/document-intelligence-rag.md)
- **Workflow builder conventions** — [docs/workflow-builder.md](docs/workflow-builder.md)
- **Tools & MCP** — [docs/automation-tools.md](docs/automation-tools.md), [docs/how-to-add-custom-tool.md](docs/how-to-add-custom-tool.md), [docs/mcp-integration.md](docs/mcp-integration.md)
- **Contribution workflow & commit style** — [CONTRIBUTING.md](CONTRIBUTING.md)
- **Ops** — [docs/docker-deployment.md](docs/docker-deployment.md), [docs/telemetry.md](docs/telemetry.md), [docs/privacy.md](docs/privacy.md), [docs/POSTMAN.md](docs/POSTMAN.md)

## Coding Conventions

Repository-specific patterns to follow (lint/prettier rules are under [Code Style](#code-style); contribution process is in [CONTRIBUTING.md](CONTRIBUTING.md)):

- **Backend layering**: `controllers/` → `routes/` → `services/` → `models/`; step execution under `agents/` (`handlers/`, `executor.js`, `runner.js`); tools in `tools/`; node catalog in `workflow/`
- **Controllers** return via `sendOK(res, payload)` / `sendError(res, code, key)`; wrap async in try/catch logging `"<fn> error"`; enforce ownership with `resource.userId.toString() !== req.user._id.toString()` → 403. Error keys are lowercase snake_case (`name_required`, `not_found`, `forbidden`)
- **Routes**: `router.use(authMiddleware)` then declare specific paths before `/:id` params
- **Step handlers** export `execute(step, context, agent, validatedStepId, timeoutMs)` and are registered in the `backend/src/agents/executor.js` handler map (key = lowercased step type). New tools alternatively follow the `meta` + `run(step, context)` registry contract — see [docs/how-to-add-custom-tool.md](docs/how-to-add-custom-tool.md)
- **Frontend**: `'use client'` components, App Router under `app/`, shared fetch client `frontend/src/lib/api.ts` (`api` / `apiGet` / `apiPost` / `apiPut` / `apiDelete`, Bearer token, 401 → `/login`), types in `frontend/src/types/`
- **Tests**: only `**/*.handler.test.js` run (`cd backend && npm test`); Jest with external deps mocked. No frontend test suite

## Common Pitfalls

- Forgetting to run the worker — workflows won't execute without it
- Running lint from `backend/` or `frontend/` — the scripts `cd ..` to the root, so just run `npm run lint` from root
- Not initializing MongoDB replica set — the app requires it; use Docker compose or init manually
- Backend uses CommonJS (`require`), frontend uses ESM/TypeScript — do not mix patterns

## Installed Skills

| Skill                    | Use Case                                        |
| ------------------------ | ----------------------------------------------- |
| wcag-audit-patterns      | Make sites work for everyone, all abilities     |
| accessibility-compliance | Accessible colors, focus states, screen readers |
| core-web-vitals          | Make pages load fast, feel responsive           |
| github-actions-docs      | Automate tests and deployments                  |
| deploy-to-vercel         | Deploy Next.js app, preview changes             |
| docker-expert            | Best practices for docker and docker compose    |

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./.next-docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output AGENTS.md|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx,03-layouts-and-pages.mdx,04-linking-and-navigating.mdx,05-server-and-client-components.mdx,06-cache-components.mdx,07-fetching-data.mdx,08-updating-data.mdx,09-caching-and-revalidating.mdx,10-error-handling.mdx,11-css.mdx,12-images.mdx,13-fonts.mdx,14-metadata-and-og-images.mdx,15-route-handlers.mdx,16-proxy.mdx,17-deploying.mdx,18-upgrading.mdx}|01-app/02-guides:{analytics.mdx,authentication.mdx,backend-for-frontend.mdx,caching.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,data-security.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,json-ld.mdx,lazy-loading.mdx,local-development.mdx,mcp.mdx,mdx.mdx,memory-usage.mdx,multi-tenant.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,prefetching.mdx,production-checklist.mdx,progressive-web-apps.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,single-page-applications.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx,videos.mdx}|01-app/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|01-app/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|01-app/02-guides/upgrading:{codemods.mdx,version-14.mdx,version-15.mdx,version-16.mdx}|01-app/03-api-reference:{07-edge.mdx,08-turbopack.mdx}|01-app/03-api-reference/01-directives:{use-cache-private.mdx,use-cache-remote.mdx,use-cache.mdx,use-client.mdx,use-server.mdx}|01-app/03-api-reference/02-components:{font.mdx,form.mdx,image.mdx,link.mdx,script.mdx}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.mdx,manifest.mdx,opengraph-image.mdx,robots.mdx,sitemap.mdx}|01-app/03-api-reference/03-file-conventions:{default.mdx,dynamic-routes.mdx,error.mdx,forbidden.mdx,instrumentation-client.mdx,instrumentation.mdx,intercepting-routes.mdx,layout.mdx,loading.mdx,mdx-components.mdx,not-found.mdx,page.mdx,parallel-routes.mdx,proxy.mdx,public-folder.mdx,route-groups.mdx,route-segment-config.mdx,route.mdx,src-folder.mdx,template.mdx,unauthorized.mdx}|01-app/03-api-reference/04-functions:{after.mdx,cacheLife.mdx,cacheTag.mdx,connection.mdx,cookies.mdx,draft-mode.mdx,fetch.mdx,forbidden.mdx,generate-image-metadata.mdx,generate-metadata.mdx,generate-sitemaps.mdx,generate-static-params.mdx,generate-viewport.mdx,headers.mdx,image-response.mdx,next-request.mdx,next-response.mdx,not-found.mdx,permanentRedirect.mdx,redirect.mdx,refresh.mdx,revalidatePath.mdx,revalidateTag.mdx,unauthorized.mdx,unstable_cache.mdx,unstable_noStore.mdx,unstable_rethrow.mdx,updateTag.mdx,use-link-status.mdx,use-params.mdx,use-pathname.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,use-selected-layout-segment.mdx,use-selected-layout-segments.mdx,userAgent.mdx}|01-app/03-api-reference/05-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,appDir.mdx,assetPrefix.mdx,authInterrupts.mdx,basePath.mdx,browserDebugInfoInTerminal.mdx,cacheComponents.mdx,cacheHandlers.mdx,cacheLife.mdx,compress.mdx,crossOrigin.mdx,cssChunking.mdx,devIndicators.mdx,distDir.mdx,env.mdx,expireTime.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,htmlLimitedBots.mdx,httpAgentOptions.mdx,images.mdx,incrementalCacheHandlerPath.mdx,inlineCss.mdx,isolatedDevBuild.mdx,logging.mdx,mdxRs.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactCompiler.mdx,reactMaxHeadersLength.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,sassOptions.mdx,serverActions.mdx,serverComponentsHmrCache.mdx,serverExternalPackages.mdx,staleTimes.mdx,staticGeneration.mdx,taint.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,turbopackFileSystemCache.mdx,typedRoutes.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,viewTransition.mdx,webVitalsAttribution.mdx,webpack.mdx}|01-app/03-api-reference/05-config:{02-typescript.mdx,03-eslint.mdx}|01-app/03-api-reference/06-cli:{create-next-app.mdx,next.mdx}|02-pages/01-getting-started:{01-installation.mdx,02-project-structure.mdx,04-images.mdx,05-fonts.mdx,06-css.mdx,11-deploying.mdx}|02-pages/02-guides:{analytics.mdx,authentication.mdx,babel.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,lazy-loading.mdx,mdx.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,post-css.mdx,preview-mode.mdx,production-checklist.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx}|02-pages/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|02-pages/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|02-pages/02-guides/upgrading:{codemods.mdx,version-10.mdx,version-11.mdx,version-12.mdx,version-13.mdx,version-14.mdx,version-9.mdx}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.mdx,02-dynamic-routes.mdx,03-linking-and-navigating.mdx,05-custom-app.mdx,06-custom-document.mdx,07-api-routes.mdx,08-custom-error.mdx}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.mdx,02-static-site-generation.mdx,04-automatic-static-optimization.mdx,05-client-side-rendering.mdx}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.mdx,02-get-static-paths.mdx,03-forms-and-mutations.mdx,03-get-server-side-props.mdx,05-client-side.mdx}|02-pages/03-building-your-application/06-configuring:{12-error-handling.mdx}|02-pages/04-api-reference:{06-edge.mdx,08-turbopack.mdx}|02-pages/04-api-reference/01-components:{font.mdx,form.mdx,head.mdx,image-legacy.mdx,image.mdx,link.mdx,script.mdx}|02-pages/04-api-reference/02-file-conventions:{instrumentation.mdx,proxy.mdx,public-folder.mdx,src-folder.mdx}|02-pages/04-api-reference/03-functions:{get-initial-props.mdx,get-server-side-props.mdx,get-static-paths.mdx,get-static-props.mdx,next-request.mdx,next-response.mdx,use-report-web-vitals.mdx,use-router.mdx,userAgent.mdx}|02-pages/04-api-reference/04-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,assetPrefix.mdx,basePath.mdx,bundlePagesRouterDependencies.mdx,compress.mdx,crossOrigin.mdx,devIndicators.mdx,distDir.mdx,env.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,httpAgentOptions.mdx,images.mdx,isolatedDevBuild.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,serverExternalPackages.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,webVitalsAttribution.mdx,webpack.mdx}|02-pages/04-api-reference/04-config:{01-typescript.mdx,02-eslint.mdx}|02-pages/04-api-reference/05-cli:{create-next-app.mdx,next.mdx}|03-architecture:{accessibility.mdx,fast-refresh.mdx,nextjs-compiler.mdx,supported-browsers.mdx}|04-community:{01-contribution-guide.mdx,02-rspack.mdx}<!-- NEXT-AGENTS-MD-END -->
