[🇬🇧 English](README.md) | [🇫🇷 Français](README.fr.md)

# PixiAudit — DevOps & Deployment

## 1. Project Overview

PixiAudit is a web application designed to automate website audits and generate recommendations. It combines web crawling, performance analysis, and AI-generated recommendations to help evaluate websites.

This repository focuses on the **DevOps and deployment infrastructure** of PixiAudit. It brings together the application services, Docker containerization, CI/CD workflows, production deployment, and PostgreSQL backup procedures.

### Main objectives

- Containerize the application services using Docker.
- Orchestrate the services with Docker Compose.
- Implement automated CI workflows using GitHub Actions.
- Build and publish Docker images to GitHub Container Registry (GHCR).
- Automate production deployment through a self-hosted GitHub Actions runner.
- Add deployment health checks and rollback handling.
- Implement PostgreSQL backup and recovery procedures.

## 2. Architecture Overview

PixiAudit follows a multi-service architecture combining Next.js, NestJS, Python, Node.js, PostgreSQL, Redis, and Ollama.

### Application architecture diagram

```mermaid
flowchart TB
    User["User / Browser"]
    Frontend["Frontend<br/>Next.js<br/>:3000"]
    Backend["Backend API<br/>NestJS<br/>:3001"]
    Redis[("Redis<br/>Bull Queue")]
    Scraper["Scraper Service<br/>Python FastAPI<br/>:8002"]
    Lighthouse["Lighthouse Service<br/>Node.js + Chrome<br/>:8003"]
    AI["AI Analysis Service<br/>Python FastAPI<br/>:8000"]
    Ollama["Ollama<br/>Mistral"]
    PostgreSQL[("PostgreSQL<br/>Database")]

    User --> Frontend
    Frontend <-->|"REST API"| Backend

    Backend -->|"Enqueue audit job"| Redis
    Redis -->|"Job available"| Backend

    Backend -->|"Scraping task"| Scraper
    Scraper -->|"Scraping results"| Backend

    Scraper -->|"Performance audit request"| Lighthouse
    Lighthouse -->|"Performance results"| Scraper

    Backend -->|"AI recommendation request"| AI
    AI -->|"AI recommendations"| Backend

    AI -->|"Generate recommendations"| Ollama
    Ollama -->|"Generated response"| AI

    Backend <-->|"Read / write audit data"| PostgreSQL

    classDef frontend fill:#dceeff,stroke:#3286c8,color:#17324d,stroke-width:1.5px
    classDef backend fill:#e8e0ff,stroke:#8560d8,color:#30204f,stroke-width:1.5px
    classDef processing fill:#e1f3e5,stroke:#4b9b61,color:#193d25,stroke-width:1.5px
    classDef infrastructure fill:#fff0d9,stroke:#d99427,color:#57380c,stroke-width:1.5px
    classDef user fill:#e5f2ff,stroke:#c8d9e8,color:#174a7e

    class User user
    class Frontend frontend
    class Backend backend
    class Scraper,Lighthouse,AI processing
    class Redis,Ollama,PostgreSQL infrastructure
```

### Services and responsibilities

| Service | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js, React, TypeScript | User interface and audit management |
| Backend | NestJS, TypeORM | REST API, authentication, application logic, and audit queue management |
| Scraper | Python, FastAPI | Website crawling and data collection |
| Lighthouse | Node.js, Chrome | Website performance analysis using Lighthouse |
| AI Service | Python, FastAPI | Generates recommendations using the AI model |
| Ollama | Ollama, Mistral | Runs the local language model |
| PostgreSQL | PostgreSQL 17.11 | Persistent application and audit data |
| Redis | Redis 7.4.11 | Queue and background-job management through Bull |

### Audit processing workflow

1. The user submits an audit request through the Next.js frontend.
2. The NestJS backend receives the request and manages the audit process.
3. The backend uses Redis and Bull to manage background audit jobs.
4. The scraper collects website information.
5. The Lighthouse service performs performance analysis using Chrome.
6. The AI service processes audit information and communicates with Ollama to generate recommendations.
7. The backend persists the relevant results in PostgreSQL.
8. The frontend displays the audit results and recommendations.

## 3. Repository Structure

```text
pixiaudit-devops/
├── .github/
│   └── workflows/
│       ├── ai-service-ci.yml
│       ├── backend-ci.yml
│       ├── frontend-ci.yml
│       ├── scraper-lighthouse-ci.yml
│       ├── compose-ci.yml
│       └── deploy.yml
│
├── ai-service/
├── backend/
├── frontend/
├── scraper/
├── lighthouse/
│
├── ci-mocks/
│   ├── lighthouse/
│   └── ollama/
│
├── docs/
│   └── backup-recovery.md
│
├── docker-compose.yml
├── docker-compose.ci.yml
├── docker-compose.deploy.yml
├── deploy.sh
├── backup-postgres.sh
├── README.md
└── README.fr.md
```

## 4. Dockerization

Each application service has its own Dockerfile, allowing independent image builds and deployments.

### Multi-stage builds

The frontend and backend use multi-stage Docker builds to separate build-time dependencies from runtime environments.

This approach helps reduce the final image size and keeps development dependencies out of the production runtime image.

### Service-specific containerization

- **Frontend:** Uses a Node.js Alpine-based image and Next.js standalone output.
- **Backend:** Uses a Node.js Alpine-based build and runtime environment.
- **Scraper:** Uses Python Slim with the dependencies required for crawling and data collection.
- **AI Service:** Uses Python Slim with FastAPI and the Ollama client.
- **Lighthouse:** Uses Node.js with Google Chrome installed for browser-based performance analysis.

The scraper and Lighthouse components are maintained as separate services. They were separated because the implementation combines two different technology environments: Python for scraping and Node.js for Lighthouse. Lighthouse also requires Google Chrome, which introduces additional installation and runtime dependencies.

Separating them makes each service easier to build, configure, maintain, and troubleshoot.

### Docker Compose

Docker Compose orchestrates the application services and infrastructure dependencies.

The repository includes different Compose configurations for different environments:

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local Docker environment |
| `docker-compose.ci.yml` | CI integration-test environment |
| `docker-compose.deploy.yml` | Production deployment environment |

## 5. Local Docker Environment

The local Docker environment runs the application services and their infrastructure dependencies.

### Main components

- Frontend
- Backend
- Scraper
- Lighthouse
- AI Service
- Ollama
- PostgreSQL
- Redis

### Network organization

Docker Compose uses separate networks to control communication between application components and infrastructure services.

The services communicate using their Compose service names rather than relying on host-specific IP addresses.

### Persistent data

Docker volumes are used to preserve important application data, including PostgreSQL, Redis, and Ollama data.

This ensures that restarting or recreating application containers does not automatically remove the persistent data stored in these volumes.

## 6. Continuous Integration (CI)

GitHub Actions automates the validation and testing of the PixiAudit services.

### CI workflows

| Workflow | Responsibility |
|---|---|
| `frontend-ci.yml` | Frontend validation and build |
| `backend-ci.yml` | Backend validation, tests, and build |
| `scraper-lighthouse-ci.yml` | Scraper and Lighthouse validation |
| `ai-service-ci.yml` | AI service validation |
| `compose-ci.yml` | Full-stack Compose integration testing |

### Compose integration testing

The Compose CI workflow validates the integrated application environment.

Its main stages include:

1. Validate the Docker Compose configuration.
2. Build the CI service images.
3. Start the integration-test environment.
4. Use CI mocks for external or resource-intensive dependencies.
5. Check the health and availability of the services.
6. Test important application endpoints.
7. Collect logs if a failure occurs.
8. Stop and remove the CI environment.

The CI environment uses dedicated mocks for Lighthouse and Ollama so that integration testing does not depend on running a full browser-based performance audit or downloading and executing the language model.

### Docker image publishing

After successful Compose integration testing, the workflow publishes the five application images to GitHub Container Registry (GHCR).

The published images are tagged with:

- `latest`
- The corresponding Git commit SHA.

Publishing is restricted to successful runs associated with pushes to the `main` branch.

## 7. Continuous Deployment (CD)

PixiAudit uses a self-hosted GitHub Actions runner to automate production deployment.

The deployment workflow is triggered after the successful completion of the Compose CI workflow on the `main` branch.

### Deployment architecture diagram

```mermaid
flowchart TD
    A["GitHub Push to main"] --> B["PixiAudit Compose CI"]
    B --> C["Build and Integration Tests"]
    C --> D["Publish 5 Docker Images to GHCR"]
    D --> E["Successful CI Completion"]
    E --> F["PixiAudit CD Workflow"]
    F --> G["Self-hosted Deployment Runner"]
    G --> H["Restricted Deployment Script"]
    H --> I["Pull SHA-tagged Images"]
    I --> J["Docker Compose Production"]
    J --> K["Production Health Checks"]
```

### Deployment process

1. A change is pushed to the `main` branch.
2. The Compose CI workflow builds the application images and runs integration tests.
3. After successful integration testing, the five application images are published to GHCR.
4. The CD workflow starts after the successful completion of the CI workflow.
5. The self-hosted runner invokes the restricted deployment helper.
6. The deployment helper receives the exact Git commit SHA associated with the successful CI run.
7. The corresponding SHA-tagged images are pulled from GHCR.
8. Docker Compose updates the production application services.
9. Health checks verify that the deployed services are operational.

### Self-hosted runner

The deployment runner operates on the production host and is registered at repository level.

It uses a dedicated system account named `gha-deploy`. The account does not have direct access to the Docker socket or general sudo privileges.

Instead, it is authorized to invoke a specific root-owned deployment helper through a restricted sudoers rule.

### Deployment helper and rollback

The deployment helper is located at:

```text
/usr/local/sbin/pixiaudit-deploy
```

It performs the following operations:

- Validates the requested commit SHA.
- Acquires a deployment lock.
- Pulls the required images.
- Updates services in a controlled order.
- Checks deployment results.
- Attempts to restore previously deployed images if an update fails.

The application services are updated in the following order:

1. Lighthouse
2. Scraper
3. AI Service
4. Backend
5. Frontend

PostgreSQL, Redis, and Ollama are not updated as part of the application image deployment sequence.


## 8. Production Environment

The production environment is orchestrated using:

```text
docker-compose.deploy.yml
```

### Production services

| Component | Image / Technology |
|---|---|
| Frontend | PixiAudit frontend image from GHCR |
| Backend | PixiAudit backend image from GHCR |
| Scraper | PixiAudit scraper image from GHCR |
| Lighthouse | PixiAudit Lighthouse image from GHCR |
| AI Service | PixiAudit AI service image from GHCR |
| PostgreSQL | `postgres:17.11` |
| Redis | `redis:7.4.11` |
| Ollama | `ollama/ollama:0.40.11` |



### Environment and secrets

The production environment file is:

```text
.env.deploy
```

It is excluded from Git and restricted through filesystem permissions.

Sensitive values such as the PostgreSQL password, JWT secret, and SMTP password are provided through files in the `secrets/` directory.

These files are also excluded from Git and protected with restrictive permissions.

## 9. Security Model

This section documents the security controls that protect the production deployment. The goal is to make the trust boundaries explicit, so that a change to any one control can be reviewed against the rest of the model.

### 9.1 Trust boundaries

The deployment architecture separates four distinct privilege levels:

| Level | Identity / Location | What it can do |
|---|---|---|
| Contributor | Any GitHub account with push access | Open branches and pull requests |
| CI | GitHub-hosted runners (`ubuntu-latest`) | Build, test, and publish images |
| Deploy runner | `gha-deploy` system account on the production host | Invoke one restricted sudo rule, nothing else |
| Privileged deploy | `root`, via `/usr/local/sbin/pixiaudit-deploy` | Run Docker Compose as the `mahdi` account |

The `gha-deploy` account is deliberately **not** a member of the `docker` or `sudo` groups, and it cannot read `.env.deploy` or any file under `secrets/`.

### 9.2 Branch protection on `main`

The `main` branch is governed by an active ruleset named `Protect main`:

- Direct pushes to `main` are blocked — changes must arrive through a pull request.
- Force pushes to `main` are blocked (`non_fast_forward`).
- Deletion of `main` is blocked.
- The bypass list is empty, so no account — including the repository owner — can bypass the ruleset.

Because the CD workflow only runs after a successful `PixiAudit Compose CI` run on `main`, every deployable change is tied to a pull request and a passing CI run.

The ruleset currently does **not** require an approving review. This is intentional for a solo-maintained repository: GitHub does not allow an author to approve their own pull request, so requiring one approval would deadlock every change. The enforced property is instead "no direct pushes, no force pushes, every deploy comes from a CI-validated PR."

### 9.3 Deployment trigger restrictions

The CD workflow is triggered by `workflow_run` completion, and its `if:` condition rejects any run that is not all of:

- A **successful** Compose CI run.
- Triggered by a **push** event (not a pull request).
- Targeting the **`main`** branch.
- Originating from the **same repository** (`head_repository.full_name == github.repository`).

The effect is that pull requests — including those opened from forks — cannot reach the self-hosted runner, even if they modify the workflow files.

### 9.4 Restricted sudo and the deployment helper

The `gha-deploy` account has exactly one sudo permission:

```text
(root) NOPASSWD: /usr/local/sbin/pixiaudit-deploy ""
