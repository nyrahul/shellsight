#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ShellSight Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker-compose or docker compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}Error: Docker Compose is not installed.${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed${NC}"
echo -e "${GREEN}✓ Docker Compose is available ($COMPOSE_CMD)${NC}"
echo

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"

    if [ ! -f .env.example ]; then
        echo -e "${RED}Error: .env.example not found.${NC}"
        exit 1
    fi

    cp .env.example .env

    # Generate random secrets
    SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -d '\n' | head -c 64)
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -d '\n' | head -c 64)

    # Update secrets in .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/SESSION_SECRET=change-me-to-a-random-string/SESSION_SECRET=$SESSION_SECRET/" .env
        sed -i '' "s/JWT_SECRET=change-me-to-another-random-string/JWT_SECRET=$JWT_SECRET/" .env
    else
        # Linux
        sed -i "s/SESSION_SECRET=change-me-to-a-random-string/SESSION_SECRET=$SESSION_SECRET/" .env
        sed -i "s/JWT_SECRET=change-me-to-another-random-string/JWT_SECRET=$JWT_SECRET/" .env
    fi

    echo -e "${GREEN}✓ Created .env file with generated secrets${NC}"
    echo
    echo -e "${YELLOW}IMPORTANT: Please edit .env to configure:${NC}"
    echo "  - S3 storage settings (S3_BUCKET, S3_ENDPOINT, etc.)"
    echo "  - Authentication settings (AUTH_DISABLED or OAuth providers)"
    echo "  - BASE_URL and FRONTEND_URL for your domain"
    echo
    read -p "Press Enter to continue after editing .env, or Ctrl+C to exit..."
fi

echo
echo -e "${GREEN}Building and starting containers...${NC}"
echo

# Build and start
$COMPOSE_CMD up -d --build

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo "ShellSight is now running."
echo
echo "Access the application at: http://localhost"
echo "(or your configured domain)"
echo
echo "Useful commands:"
echo "  View logs:       $COMPOSE_CMD logs -f"
echo "  Stop:            $COMPOSE_CMD down"
echo "  Restart:         $COMPOSE_CMD restart"
echo "  Rebuild:         $COMPOSE_CMD up -d --build"
echo
