# Leadership Assessment Platform

A web-based platform for conducting and managing leadership assessments.

## Project Structure

```
.
├── app/
│   ├── frontend/     # React frontend application
│   └── backend/      # Node.js backend API
├── database/
│   └── init/         # Database initialization scripts
├── data/
│   └── postgres/     # PostgreSQL data directory
├── nginx/
│   ├── conf/         # Nginx configuration
│   └── ssl/          # SSL certificates
├── docker-compose.yml
└── .env              # Environment variables (not in git)
```

## Prerequisites

- Docker
- Docker Compose
- Node.js (for local development)
- PostgreSQL (for local development)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
API_URL=https://your-domain.com
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
ENCRYPTION_KEY=your-secure-encryption-key
ADMIN_KEY=your-secure-admin-key
FRONTEND_URL=https://your-domain.com
DB_USER=your-db-user
DB_PASSWORD=your-secure-db-password
DB_NAME=leadership_assessment
```

## Development Setup

1. Clone the repository

```bash
git clone <repository-url>
cd leadership-assessment
```

2. Install dependencies

```bash
# Frontend
cd app/frontend
npm install

# Backend
cd ../backend
npm install
```

3. Start the development environment

```bash
docker-compose up
```

## Production Deployment

1. Set up environment variables
2. Configure SSL certificates in `nginx/ssl/`
3. Build and start containers

```bash
docker-compose up -d --build
```

## License

[Your License]
