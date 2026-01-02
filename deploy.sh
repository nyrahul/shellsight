#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
UNINSTALL=false
AUTO_YES=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        -y|--yes)
            AUTO_YES=true
            shift
            ;;
        -h|--help)
            echo "ShellSight Deployment Script"
            echo ""
            echo "Usage: ./deploy.sh [options]"
            echo ""
            echo "Options:"
            echo "  --uninstall            Uninstall ShellSight and all components"
            echo "  -y, --yes              Auto-answer yes to all prompts (for uninstall)"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Before running this script, configure your .env file with S3 credentials."
            echo "For S3-compatible storage like RustFS, use ./deploy-rustfs.sh first."
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check for docker-compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}Error: Docker Compose is not installed.${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Handle uninstall
if [ "$UNINSTALL" = true ]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ShellSight Uninstall${NC}"
    echo -e "${RED}========================================${NC}"
    echo

    echo -e "${YELLOW}This will remove all ShellSight containers and networks.${NC}"
    if [ "$AUTO_YES" = true ]; then
        confirm="y"
    else
        read -p "Are you sure you want to continue? [y/N]: " confirm
    fi
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Uninstall cancelled."
        exit 0
    fi

    echo
    echo -e "${BLUE}Stopping and removing ShellSight containers...${NC}"
    $COMPOSE_CMD down 2>/dev/null || true

    echo -e "${GREEN}✓ ShellSight containers removed${NC}"

    # Ask about volumes
    echo
    echo -e "${YELLOW}Do you want to remove Docker volumes (this will delete all data)?${NC}"
    if [ "$AUTO_YES" = true ]; then
        remove_volumes="y"
    else
        read -p "Remove volumes? [y/N]: " remove_volumes
    fi
    if [[ "$remove_volumes" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Removing volumes...${NC}"
        $COMPOSE_CMD down -v 2>/dev/null || true
        echo -e "${GREEN}✓ Volumes removed${NC}"
    fi

    # Ask about config files
    echo
    echo -e "${YELLOW}Do you want to remove configuration files (.env)?${NC}"
    if [ "$AUTO_YES" = true ]; then
        remove_config="y"
    else
        read -p "Remove config files? [y/N]: " remove_config
    fi
    if [[ "$remove_config" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Removing configuration files...${NC}"
        rm -f .env 2>/dev/null || true
        echo -e "${GREEN}✓ Configuration files removed${NC}"
    fi

    echo
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Uninstall Complete${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo
    echo "ShellSight has been uninstalled."
    exit 0
fi

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
    echo -e "${YELLOW}IMPORTANT: Configure the following in .env before continuing:${NC}"
    echo -e "${YELLOW}  - SUPERADMIN_EMAIL (required)${NC}"
    echo -e "${YELLOW}  - S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET${NC}"
    echo
    echo -e "${BLUE}If you need S3-compatible storage, run ./deploy-rustfs.sh first.${NC}"
    echo
    read -p "Press Enter to continue after configuring .env, or Ctrl+C to cancel..."
fi

# Validate required configuration
SUPERADMIN_EMAIL=$(grep "^SUPERADMIN_EMAIL=" .env | cut -d'=' -f2-)
S3_ACCESS_KEY=$(grep "^S3_ACCESS_KEY=" .env | cut -d'=' -f2-)
S3_SECRET_KEY=$(grep "^S3_SECRET_KEY=" .env | cut -d'=' -f2-)

if [ -z "$SUPERADMIN_EMAIL" ] || [ "$SUPERADMIN_EMAIL" = "admin@example.com" ]; then
    echo -e "${RED}Error: SUPERADMIN_EMAIL is not configured in .env${NC}"
    echo -e "${RED}Please set SUPERADMIN_EMAIL to the email address of the superadmin user.${NC}"
    exit 1
fi

if [ -z "$S3_ACCESS_KEY" ] || [ -z "$S3_SECRET_KEY" ]; then
    echo -e "${YELLOW}Warning: S3_ACCESS_KEY or S3_SECRET_KEY is not set in .env${NC}"
    echo -e "${YELLOW}ShellSight requires S3 storage to function properly.${NC}"
    echo
    read -p "Continue anyway? [y/N]: " continue_anyway
    if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled. Please configure S3 settings in .env"
        exit 1
    fi
fi

echo
echo -e "${GREEN}Building and starting containers...${NC}"
echo

$COMPOSE_CMD up -d --build

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo "ShellSight is now running."
echo
echo -e "${BLUE}Access the application at:${NC} http://localhost"
echo "(or your configured domain)"
echo
echo "Useful commands:"
echo "  View logs:       $COMPOSE_CMD logs -f"
echo "  Stop:            $COMPOSE_CMD down"
echo "  Restart:         $COMPOSE_CMD restart"
echo "  Rebuild:         $COMPOSE_CMD up -d --build"
echo
