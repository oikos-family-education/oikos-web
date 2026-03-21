# Oikos - Open Source Family Education Platform

## Project Overview
Oikos is an open source platform for family education. This monorepo contains the true "day zero" setup, including a Next.js 14 frontend, a FastAPI backend, and shared packages.

## Prerequisites
- Node.js 20 LTS
- Python 3.12
- Docker & Docker Compose
- npm (workspaces)

## Quickstart

### Local Environment
1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
2. Start the development stack (PostgreSQL, Redis, API, and Web):
   ```bash
   docker compose up -d
   ```
3. The frontend is accessible at `http://localhost:3000`
4. The API is accessible at `http://localhost:8000`
5. Alembic migrations are applied automatically!

### Manual / Host Development
If you prefer running the processes on your host machine for better hot-reloading:

1. Copy `.env.example` to `.env`.
2. Start only the backing services:
   ```bash
   docker compose up -d db redis
   ```
3. Install Node dependencies:
   ```bash
   npm install
   ```
4. Run the frontend and API via Turborepo:
   ```bash
   npm run dev
   ```
*Note: Make sure to set up your python virtual environment inside `apps/api` and install `requirements.txt`*
