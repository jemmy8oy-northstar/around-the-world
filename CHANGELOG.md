# Changelog

All notable changes to this template are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Versions are assigned automatically by **GitVersion** (Mainline mode — see
[Versioning & Releases](README.md#versioning--releases) in the README); this repo
carries no manual version tags, so historical entries below are dated and cite the
merge commit rather than a version number. Add to the `[Unreleased]` section in
every PR; the entries roll into the next release heading when a version is cut.

## [Unreleased]

### Added
- Global exception handling: an `AppException` hierarchy in
  `Abstractions/Exceptions/` (`NotFound`/`Validation`/`Conflict`/`Unauthorized`/
  `Forbidden`/`UpstreamService`) plus a native `IExceptionHandler`
  (`WebApi/ExceptionHandling/`) that renders every one as an RFC 7807
  `ProblemDetails`. Services throw; routes carry no `try/catch`. Documented in
  `backend-architecture.md` §9 and the agent rules, including the guidance to add
  a new exception type when none fits ([#73](https://github.com/jemmy8oy-northstar/web-template/pull/73)).
- This `CHANGELOG.md` and a README "Versioning & Releases" section documenting the
  existing GitVersion pipeline ([#74](https://github.com/jemmy8oy-northstar/web-template/pull/74)).

### Changed
- Build-time OpenAPI generation: the backend now emits its schema via
  `Microsoft.Extensions.ApiDescription.Server` on a Debug build (in-process, no running
  server or database) into a committed `openapi.json`, and frontend codegen reads that
  file instead of `http://localhost:5257`. `npm run codegen` now works offline and in CI.
  The startup DB migration is skipped when the build-time generator loads the app. Fixes
  the previously-broken `RenameOpenApiFile` target
  ([#76](https://github.com/jemmy8oy-northstar/web-template/issues/76)).

## 2026-07-11

### Changed
- Typed route-delegate docs: `backend-architecture.md`, `backend-srp.md` and
  `openapi-codegen.md` now show named static handlers with concrete `TypedResults`
  return types instead of inline lambdas, so OpenAPI (and the generated frontend
  client) can infer response bodies (`2f489ad`, [#71](https://github.com/jemmy8oy-northstar/web-template/pull/71)).

## 2026-07-10

### Added
- Backend convention enforcement: `StyleCop.Analyzers` wired through
  `Directory.Build.props` with `.editorconfig`, promoting **SA1402** (one type per
  file) to a build error; documented in `backend-architecture.md` §8 and
  `backend-srp.md` (`9eead2d`, [#69](https://github.com/jemmy8oy-northstar/web-template/pull/69)).

## 2026-07-05

### Security
- Resolved high-severity package advisories — AutoMapper bumped to 16.1.1 and
  `Microsoft.OpenApi` pinned to 2.7.5 (`6999273`).

## 2026-06-20

### Added
- Deployment pipeline: multi-stage backend/frontend Dockerfiles, Helm chart, and
  the `docker-build-push.yml` workflow — GitVersion computes the SemVer, tags the
  ARM64 images, and commits the new tag into `helm/values.yaml` (gitops release
  loop). Frontend routing with configurable base URL (`a84df47`, [#63](https://github.com/jemmy8oy-northstar/web-template/pull/63)).

### Changed
- Migrated the Claude GitHub Action to the `@claude` mention-trigger model with a
  scoped tool allowlist (`ab9a328`, `68aa939`, `0fe55bb`).
- Database registration is skipped when no connection string is configured, so the
  app boots without a database for local/demo use (`d111f71`).
