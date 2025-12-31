# FreqHub Makefile
# Inspired by NautilusTrader's automation approach
# Provides simple commands for common development tasks

.PHONY: help install setup dev build test lint format clean docker-up docker-down docker-build docker-logs db-migrate db-seed db-example test-websocket test-polling

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

##@ Help

help: ## Display this help message
	@echo "$(BLUE)FreqHub - Makefile Commands$(NC)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Setup & Installation

install: ## Install all dependencies (backend + frontend)
	@echo "$(BLUE)Installing backend dependencies...$(NC)"
	cd backend && npm install
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	cd frontend && npm install
	@echo "$(BLUE)Installing frontend UI dependencies (Tailwind, Recharts, etc.)...$(NC)"
	cd frontend && npm install -D tailwindcss postcss autoprefixer @types/node || true
	cd frontend && npm install recharts lucide-react || true
	@if [ ! -f frontend/tailwind.config.js ] && [ ! -f frontend/tailwind.config.ts ]; then \
		echo "$(BLUE)Initializing Tailwind CSS...$(NC)"; \
		cd frontend && npx tailwindcss init -p || echo "$(YELLOW)⚠ Tailwind init skipped (may already exist)$(NC)"; \
	fi
	@echo "$(GREEN)✓ All dependencies installed$(NC)"

setup: ## Complete initial setup (install + env files + example DB)
	@echo "$(BLUE)Setting up FreqHub...$(NC)"
	@$(MAKE) install
	@echo "$(BLUE)Creating .env files...$(NC)"
	@if [ ! -f backend/.env ]; then \
		cp backend/.env.example backend/.env && \
		echo "$(YELLOW)⚠ Created backend/.env from .env.example - please update with your values$(NC)"; \
	fi
	@if [ ! -f frontend/.env ]; then \
		cp frontend/.env.example frontend/.env 2>/dev/null || echo "$(YELLOW)⚠ No frontend/.env.example found$(NC)"; \
	fi
	@if [ ! -f backend/data/freqhub.db ]; then \
		cp backend/data/freqhub.db.example backend/data/freqhub.db 2>/dev/null || \
		echo "$(YELLOW)⚠ No example database found - database will be created on first run$(NC)"; \
	fi
	@echo "$(GREEN)✓ Setup complete!$(NC)"
	@echo "$(YELLOW)Don't forget to:$(NC)"
	@echo "  1. Update backend/.env with your configuration"
	@echo "  2. Set ENCRYPTION_KEY to a secure value (min 32 characters)"

##@ Development

dev: ## Start development servers (backend + frontend in parallel)
	@echo "$(BLUE)Starting development servers...$(NC)"
	@echo "$(YELLOW)Backend: http://localhost:3001$(NC)"
	@echo "$(YELLOW)Frontend: http://localhost:3000$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to stop$(NC)"
	@trap 'kill 0' EXIT; \
	cd backend && npm run dev & \
	cd frontend && npm run dev & \
	wait

dev-backend: ## Start backend development server only
	@echo "$(BLUE)Starting backend development server...$(NC)"
	cd backend && npm run dev

dev-frontend: ## Start frontend development server only
	@echo "$(BLUE)Starting frontend development server...$(NC)"
	cd frontend && npm run dev

##@ Build

build: ## Build both backend and frontend for production
	@echo "$(BLUE)Building backend...$(NC)"
	cd backend && npm run build
	@echo "$(BLUE)Building frontend...$(NC)"
	cd frontend && npm run build
	@echo "$(GREEN)✓ Build complete!$(NC)"

build-backend: ## Build backend only
	@echo "$(BLUE)Building backend...$(NC)"
	cd backend && npm run build

build-frontend: ## Build frontend only
	@echo "$(BLUE)Building frontend...$(NC)"
	cd frontend && npm run build

##@ Code Quality

lint: ## Run linters on both backend and frontend
	@echo "$(BLUE)Linting backend...$(NC)"
	cd backend && npm run lint
	@echo "$(BLUE)Linting frontend...$(NC)"
	cd frontend && npm run lint 2>/dev/null || echo "$(YELLOW)⚠ Frontend linting not configured$(NC)"

lint-fix: ## Fix linting issues automatically
	@echo "$(BLUE)Fixing linting issues...$(NC)"
	cd backend && npm run lint:fix
	cd frontend && npm run lint:fix 2>/dev/null || echo "$(YELLOW)⚠ Frontend lint:fix not configured$(NC)"

format: ## Format code with Prettier
	@echo "$(BLUE)Formatting code...$(NC)"
	cd backend && npm run format
	cd frontend && npm run format 2>/dev/null || echo "$(YELLOW)⚠ Frontend formatting not configured$(NC)"

##@ Testing

test: ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	@echo "$(YELLOW)⚠ Test suite not yet implemented$(NC)"

test-websocket: ## Test WebSocket connection
	@echo "$(BLUE)Testing WebSocket connection...$(NC)"
	cd backend && npm run test:websocket

test-polling: ## Test polling service
	@echo "$(BLUE)Testing polling service...$(NC)"
	cd backend && ./scripts/test-polling.sh

##@ Database

db-migrate: ## Run database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	cd backend && npm run db:migrate

db-seed: ## Seed database with sample data
	@echo "$(BLUE)Seeding database...$(NC)"
	cd backend && npm run db:seed

db-example: ## Create example database
	@echo "$(BLUE)Creating example database...$(NC)"
	cd backend && npm run db:example

##@ Docker

docker-up: ## Start all services with Docker Compose
	@echo "$(BLUE)Starting Docker services...$(NC)"
	docker-compose -f docker-compose.full.yml up -d
	@echo "$(GREEN)✓ Services started$(NC)"
	@echo "$(YELLOW)Backend: http://localhost:3001$(NC)"
	@echo "$(YELLOW)Frontend: http://localhost:3000$(NC)"

docker-down: ## Stop all Docker services
	@echo "$(BLUE)Stopping Docker services...$(NC)"
	docker-compose -f docker-compose.full.yml down
	@echo "$(GREEN)✓ Services stopped$(NC)"

docker-build: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker-compose -f docker-compose.full.yml build

docker-logs: ## Show Docker logs
	docker-compose -f docker-compose.full.yml logs -f

docker-restart: ## Restart Docker services
	@echo "$(BLUE)Restarting Docker services...$(NC)"
	docker-compose -f docker-compose.full.yml restart

docker-clean: ## Stop and remove all containers, networks, and volumes
	@echo "$(YELLOW)⚠ This will remove all containers, networks, and volumes$(NC)"
	docker-compose -f docker-compose.full.yml down -v --remove-orphans
	@echo "$(GREEN)✓ Cleaned up$(NC)"

##@ Cleanup

clean: ## Remove build artifacts and node_modules
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -rf backend/dist
	rm -rf frontend/dist
	@echo "$(GREEN)✓ Build artifacts removed$(NC)"

clean-all: clean ## Remove everything including node_modules (use with caution)
	@echo "$(YELLOW)⚠ Removing node_modules...$(NC)"
	rm -rf backend/node_modules
	rm -rf frontend/node_modules
	@echo "$(GREEN)✓ Everything cleaned$(NC)"

##@ Utilities

status: ## Check service status
	@echo "$(BLUE)Checking service status...$(NC)"
	@echo "$(YELLOW)Backend:$(NC)"
	@curl -s http://localhost:3001/api/healthz > /dev/null && echo "  $(GREEN)✓ Running$(NC)" || echo "  $(YELLOW)✗ Not running$(NC)"
	@echo "$(YELLOW)Frontend:$(NC)"
	@curl -s http://localhost:3000 > /dev/null && echo "  $(GREEN)✓ Running$(NC)" || echo "  $(YELLOW)✗ Not running$(NC)"

logs-backend: ## Show backend logs (if running in Docker)
	docker-compose -f docker-compose.full.yml logs -f backend

logs-frontend: ## Show frontend logs (if running in Docker)
	docker-compose -f docker-compose.full.yml logs -f frontend

