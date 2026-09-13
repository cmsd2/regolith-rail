## Purpose

Delivers Regolith Rail as a set of static files that work unchanged on GitHub Pages
or Amazon S3, deployed automatically from CI.

## ADDED Requirements

### Requirement: Static output
The build SHALL produce a directory of static files that needs no server-side
code, no URL rewrite rules and no custom response headers. Every documentation
page SHALL exist as its own HTML file. Unknown paths SHALL be served a static
not-found page with links to the application and documentation.

#### Scenario: Served by a plain file server
- **WHEN** the build output is served by a static file server with no
  configuration
- **THEN** the application, every documentation page and the not-found page
  load and work

### Requirement: Configurable base path
The base path SHALL be set at build time, so the same source works at the root
of a domain and under a sub-path.

#### Scenario: Project site sub-path
- **WHEN** the site is built for the base path `/regolith-rail/` and served there
- **THEN** all pages, assets, workers and WebAssembly modules load, and internal
  links stay under `/regolith-rail/`

### Requirement: No cross-origin isolation
The application SHALL work without cross-origin isolation, because neither host
sets the headers that enable it by default.

#### Scenario: Default headers
- **WHEN** the site is served without cross-origin isolation headers
- **THEN** single runs and batches work

### Requirement: Self-contained resources
The application and documentation SHALL load all scripts, styles, fonts,
WebAssembly and data from their own origin and SHALL make no requests to
third-party services.

#### Scenario: No third-party requests
- **WHEN** the application is used for a run, a batch and a documentation search
- **THEN** every network request goes to the site's own origin

### Requirement: Cache-safe assets
Scripts, styles, WebAssembly and other build assets SHALL have content-hashed
file names so they can be cached indefinitely. HTML files SHALL NOT be
content-hashed.

#### Scenario: New deployment
- **WHEN** a new version is deployed over an old one
- **THEN** visitors receive the new version on their next page load without
  loading a mix of old and new assets

### Requirement: Visible version
The application and documentation SHALL show the application version and source
commit they were built from.

#### Scenario: Version in footer
- **WHEN** a visitor opens the About page
- **THEN** it shows the version and commit of the deployment

### Requirement: GitHub Pages deployment
A push to `main` SHALL build the site and deploy it to GitHub Pages only after
all checks pass. Pull requests SHALL build the site without deploying it.

#### Scenario: Failing checks
- **WHEN** a push to `main` fails the determinism tests
- **THEN** nothing is deployed and the previous deployment stays live

#### Scenario: Pull request
- **WHEN** a pull request is opened
- **THEN** the site is built and checked, and the live site is unchanged

### Requirement: Rollback
It SHALL be possible to redeploy any earlier commit of `main` from CI without
changing the repository.

#### Scenario: Redeploy earlier commit
- **WHEN** a maintainer starts the deployment manually for an earlier commit
- **THEN** that commit's build becomes the live site

### Requirement: S3 deployment guide
The documentation SHALL describe how to deploy the same build to an S3 bucket,
optionally behind CloudFront, including content types for WebAssembly and other
assets, cache settings for hashed assets and HTML, and the not-found page.

#### Scenario: Following the guide
- **WHEN** a maintainer follows the S3 guide with a build for the root base path
- **THEN** the site works from the bucket or distribution as it does on GitHub
  Pages
