# Plane Manager

Visual infrastructure manager. Build, layer, and verify infrastructure using a visual canvas that directly deploy your changes. Aims to be secure by default and easily scalable, supporting home lab deployments as well as popular PaaS providers.

## Getting started

At its current stage, 

1. Configure the Planemanager service and tailor it to your needs. The minimal set of environment variables are:
  - `USERNAME=<the-username-you-log-in`

## Development
### Quick start
1. Ensure you have a Docker (or Podman) server running:
  - `docker info`
2. Copy env defaults:
  - `cp .env.example .env`
3. Start dev servers:
  - `task dev`

Web: `http://localhost:4001`
API: `http://localhost:4000`
API Docs: `http://localhost:4000/api/docs`
OpenAPI JSON: `http://localhost:4000/api/openapi.json`


### Technical Details

- Uses OpenTofu to provision infrastructure (with config in JSON format)
- Stores and manages the OpenTofu config in embedded Git
- Stores all sensitive data encrypted at rest
- Has a plugin architecture for various infrastructure elements

### Structure

- `web` - React + Vite UI with React Flow canvas.
- `cmd/server` + `internal/server` - Go HTTP API and static asset server.

## Roadmap

### Backend
- [x] Accept SSH key pair from user at POST /api/user or generate key pair
- [x] Support authentication by SSH key decryption challenge
- [x] Deploy API endpoint /api/deploy
  - [o] Docker runner
    - [x] Git checkout definition
    - [x] Transfer sensitive information in-memory only
    - [ ] Encrypt/decrypt OpenTofu state from runner
  - [ ] K8S runner
    - [ ] Implement Job
    - [ ] Vault support for sensitive information
    - [ ] S3-compatibe encrypted state storage
- [ ] Health endpoint should report if service is secure
- [ ] OpenTofu module plugins

### Frontend
- [ ] Canvas
- [ ] Node plugins
- [ ] Deploy from web
- [ ] Versioning based on Git
- [ ] Node bundles for complex deployment simplified

### Generic
- [ ] Tests
- [ ] Easy downloadable installer

