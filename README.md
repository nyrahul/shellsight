# ShellSight

[![100% AI Generated](https://img.shields.io/badge/100%25-AI_Generated-blueviolet?style=flat-square)](https://claude.ai)
[![Built with Claude Code](https://img.shields.io/badge/Built_with-Claude_Code-orange?style=flat-square&logo=anthropic)](https://claude.ai/claude-code)

A web-based dashboard for administrators to monitor shell access and audit user sessions through recorded shell session replay.

## Features

- **Shell Replay** - Replay recorded shell sessions with variable speed control (1x-12x)
- **Session List** - Browse all recorded sessions with timestamps, duration, and workload info
- **Progress Tracking** - Visual progress bar showing replay position and duration
- **Download Recordings** - Export session recordings as `.tgz` archives
- **Dark/Light Theme** - Toggle between dark and light modes with persistent preference
- **Collapsible Sidebar** - Minimize sidebar with hover-to-expand functionality
- **Cluster Management** - View and manage execution clusters
- **MCP Servers** - Monitor Model Context Protocol servers
- **Resource Usage** - Monitor CPU, memory, and other resource metrics
- **User Management** - Manage users and permissions

## Prerequisites

- Node.js 18+
- npm

## Installation

```bash
npm install
```

## Running the Application

### Development Mode

Run both the frontend and backend server concurrently:

```bash
npm run dev:all
```

Or run them separately:

```bash
# Frontend (Vite dev server)
npm run dev -- --host

# Backend (WebSocket server)
npm run server
```

### Production Build

```bash
npm run build
npm run preview
```

## Docker Deployment

The easiest way to deploy ShellSight to production is using Docker.

### Prerequisites

- Docker 20.10+
- Docker Compose v2+

### Quick Start

```bash
# Clone the repository
git clone <repo-url> shellsight
cd shellsight

# Run the deployment script
./deploy.sh
```

The script will:
1. Create a `.env` file from the template with generated secrets
2. Prompt you to configure settings
3. Build and start the containers

### Manual Deployment

```bash
# Copy and configure environment
cp .env.example .env
nano .env  # Edit with your settings

# Build and start containers
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

### Docker Architecture

```
┌─────────────────────────────────────────┐
│              Docker Host                 │
│                                          │
│   ┌─────────┐       ┌──────────────┐    │
│   │  nginx  │──────►│  ShellSight  │    │
│   │  :80    │ :3001 │   (Node.js)  │    │
│   └─────────┘       └──────────────┘    │
│                                          │
└─────────────────────────────────────────┘
```

- **nginx** - Reverse proxy on port 80, handles SSL termination and WebSocket upgrades
- **app** - ShellSight Node.js application on internal port 3001

### Container Management

```bash
# Rebuild after code changes
docker-compose up -d --build

# View app logs only
docker-compose logs -f app

# Restart a specific service
docker-compose restart app

# Scale (if needed)
docker-compose up -d --scale app=2
```

### Custom Port

To run on a different port, set `HTTP_PORT` in your `.env` file:

```bash
HTTP_PORT=8080
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `HOST` | `0.0.0.0` | Backend server host binding |
| `S3_ENDPOINT` | - | S3-compatible storage endpoint (e.g., RustFS, MinIO) |
| `S3_BUCKET` | `shellsight-recordings` | S3 bucket name |
| `S3_REGION` | `us-east-1` | S3 region |
| `S3_PREFIX` | - | Optional prefix/folder in bucket (e.g., `SSNREC`) |
| `S3_ACCESS_KEY` | - | S3 access key |
| `S3_SECRET_KEY` | - | S3 secret key |
| `DEBUG` | `false` | Enable debug logging (`true` or `1`) |

### SSO Authentication

ShellSight supports multiple SSO providers. Configure the providers you want to use:

**General Auth Settings:**

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_DISABLED` | `false` | Set to `true` to disable authentication (for development) |
| `SESSION_SECRET` | - | Secret for session encryption (required in production) |
| `JWT_SECRET` | - | Secret for JWT token signing (required in production) |
| `BASE_URL` | `http://localhost:3001` | Backend server URL |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend application URL |

**Running without authentication (development mode):**

```bash
AUTH_DISABLED=true npm run server
```

**Google OAuth:**

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

**GitHub OAuth:**

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |

**Microsoft OAuth:**

| Variable | Description |
|----------|-------------|
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth client secret |
| `MICROSOFT_TENANT_ID` | Azure AD tenant ID (default: `common`) |

**Generic OIDC (Keycloak, Okta, Auth0, etc.):**

| Variable | Description |
|----------|-------------|
| `OIDC_ISSUER` | OIDC issuer URL (e.g., `https://keycloak.example.com/realms/myrealm`) |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_CLIENT_SECRET` | OIDC client secret |
| `OIDC_DISPLAY_NAME` | Display name for the provider (default: `SSO`) |

**Example with Google OAuth:**

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com \
GOOGLE_CLIENT_SECRET=your-client-secret \
SESSION_SECRET=your-session-secret \
JWT_SECRET=your-jwt-secret \
npm run server
```

### Shell Session Recordings

Session recordings are stored in an S3-compatible bucket (AWS S3, RustFS, MinIO, etc.). Recordings are organized by user email, so each user only sees their own recordings.

Each recording should be in a folder containing:

- `timing` - Timing data file
- `typescript` - Terminal output file

**S3 bucket structure:**
```
s3://your-bucket/
  └── [S3_PREFIX]/
      └── user@email.com/           # User's email as folder name
          ├── recording-folder-1/
          │   ├── timing
          │   └── typescript
          ├── recording-folder-2/
          │   ├── timing
          │   └── typescript
```

**Recording files** are generated by the Linux `script` command:

```bash
script --timing=timing typescript
```

Recording naming convention: `<workload_name>_<epoch_timestamp>/`

### Running with S3-compatible storage (RustFS, MinIO)

```bash
S3_ENDPOINT=http://your-storage-host:9000 \
S3_BUCKET=recordings \
S3_PREFIX=SSNREC \
S3_ACCESS_KEY=your-access-key \
S3_SECRET_KEY=your-secret-key \
npm run server
```

## Project Structure

```
├── server/
│   └── index.js        # Express/WebSocket backend server
├── src/
│   ├── components/     # React components
│   ├── context/        # React context (theme)
│   ├── pages/          # Page components
│   ├── App.tsx         # Main application
│   └── main.tsx        # Entry point
├── public/
│   └── favicon.svg     # ShellSight favicon
├── SSNREC/             # Shell session recordings (gitignored)
└── package.json
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run server` | Start backend WebSocket server |
| `npm run dev:all` | Run both frontend and backend |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite, xterm.js
- **Backend**: Express, WebSocket (ws)
- **Icons**: Lucide React

## License

MIT
