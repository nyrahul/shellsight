#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
INSTALL_RUSTFS=false
RUSTFS_ACCESS_KEY=""
RUSTFS_SECRET_KEY=""
UNINSTALL=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --with-rustfs)
            INSTALL_RUSTFS=true
            shift
            ;;
        --rustfs-access-key)
            RUSTFS_ACCESS_KEY="$2"
            shift 2
            ;;
        --rustfs-secret-key)
            RUSTFS_SECRET_KEY="$2"
            shift 2
            ;;
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        -h|--help)
            echo "ShellSight Deployment Script"
            echo ""
            echo "Usage: ./deploy.sh [options]"
            echo ""
            echo "Options:"
            echo "  --with-rustfs              Install RustFS (S3-compatible storage) alongside ShellSight"
            echo "  --rustfs-access-key KEY    Set RustFS access key (default: auto-generated)"
            echo "  --rustfs-secret-key KEY    Set RustFS secret key (default: auto-generated)"
            echo "  --uninstall                Uninstall ShellSight and all components"
            echo "  -h, --help                 Show this help message"
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

# Handle uninstall
if [ "$UNINSTALL" = true ]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ShellSight Uninstall${NC}"
    echo -e "${RED}========================================${NC}"
    echo

    # Check for docker-compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        echo -e "${RED}Error: Docker Compose is not installed.${NC}"
        exit 1
    fi

    echo -e "${YELLOW}This will remove all ShellSight containers and networks.${NC}"
    read -p "Are you sure you want to continue? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Uninstall cancelled."
        exit 0
    fi

    echo
    echo -e "${BLUE}Stopping and removing containers...${NC}"

    # Check if RustFS compose file exists
    if [ -f docker-compose.rustfs.yml ]; then
        $COMPOSE_CMD -f docker-compose.yml -f docker-compose.rustfs.yml down --remove-orphans 2>/dev/null || true
    else
        $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
    fi

    echo -e "${GREEN}✓ Containers and networks removed${NC}"

    # Ask about volumes
    echo
    echo -e "${YELLOW}Do you want to remove Docker volumes (this will delete all data)?${NC}"
    read -p "Remove volumes? [y/N]: " remove_volumes
    if [[ "$remove_volumes" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Removing volumes...${NC}"
        if [ -f docker-compose.rustfs.yml ]; then
            $COMPOSE_CMD -f docker-compose.yml -f docker-compose.rustfs.yml down -v 2>/dev/null || true
        else
            $COMPOSE_CMD down -v 2>/dev/null || true
        fi
        # Also remove any orphaned shellsight volumes
        docker volume rm shellsight_rustfs-data shellsight_rustfs-logs 2>/dev/null || true
        docker volume rm rustfs-data rustfs-logs 2>/dev/null || true
        echo -e "${GREEN}✓ Volumes removed${NC}"
    fi

    # Ask about config files
    echo
    echo -e "${YELLOW}Do you want to remove configuration files (.env, docker-compose.rustfs.yml)?${NC}"
    read -p "Remove config files? [y/N]: " remove_config
    if [[ "$remove_config" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Removing configuration files...${NC}"
        rm -f .env docker-compose.rustfs.yml 2>/dev/null || true
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

# Ask about RustFS installation if not specified via command line
if [ "$INSTALL_RUSTFS" = false ]; then
    echo -e "${YELLOW}Do you want to install RustFS (S3-compatible storage) on this VM?${NC}"
    echo "This is useful if you don't have an existing S3 storage."
    read -p "Install RustFS? [y/N]: " install_rustfs_answer
    if [[ "$install_rustfs_answer" =~ ^[Yy]$ ]]; then
        INSTALL_RUSTFS=true
    fi
fi

# Generate RustFS credentials if installing
if [ "$INSTALL_RUSTFS" = true ]; then
    echo
    echo -e "${BLUE}Setting up RustFS...${NC}"

    # Generate access key if not provided
    if [ -z "$RUSTFS_ACCESS_KEY" ]; then
        RUSTFS_ACCESS_KEY=$(openssl rand -hex 10 2>/dev/null || head -c 20 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
    fi

    # Generate secret key if not provided
    if [ -z "$RUSTFS_SECRET_KEY" ]; then
        RUSTFS_SECRET_KEY=$(openssl rand -hex 20 2>/dev/null || head -c 40 /dev/urandom | base64 | tr -d '/+=' | head -c 40)
    fi

    echo -e "${GREEN}✓ Generated RustFS credentials${NC}"
fi

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
fi

# Configure RustFS in .env if installing
if [ "$INSTALL_RUSTFS" = true ]; then
    # Update S3 settings for local RustFS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|S3_ENDPOINT=.*|S3_ENDPOINT=http://rustfs:9000|" .env
        sed -i '' "s|S3_ACCESS_KEY=.*|S3_ACCESS_KEY=$RUSTFS_ACCESS_KEY|" .env
        sed -i '' "s|S3_SECRET_KEY=.*|S3_SECRET_KEY=$RUSTFS_SECRET_KEY|" .env
        sed -i '' "s|S3_BUCKET=.*|S3_BUCKET=shellsight-recordings|" .env
    else
        sed -i "s|S3_ENDPOINT=.*|S3_ENDPOINT=http://rustfs:9000|" .env
        sed -i "s|S3_ACCESS_KEY=.*|S3_ACCESS_KEY=$RUSTFS_ACCESS_KEY|" .env
        sed -i "s|S3_SECRET_KEY=.*|S3_SECRET_KEY=$RUSTFS_SECRET_KEY|" .env
        sed -i "s|S3_BUCKET=.*|S3_BUCKET=shellsight-recordings|" .env
    fi

    # Add RustFS credentials to .env
    if ! grep -q "RUSTFS_ACCESS_KEY" .env; then
        cat >> .env << EOF

# RustFS Configuration (auto-generated)
RUSTFS_ACCESS_KEY=$RUSTFS_ACCESS_KEY
RUSTFS_SECRET_KEY=$RUSTFS_SECRET_KEY
EOF
    fi

    echo -e "${GREEN}✓ Configured S3 settings for local RustFS${NC}"

    # Create docker-compose override for RustFS
    cat > docker-compose.rustfs.yml << 'EOF'
services:
  rustfs:
    image: rustfs/rustfs:latest
    container_name: shellsight-rustfs
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - RUSTFS_ACCESS_KEY=${RUSTFS_ACCESS_KEY:-rustfsadmin}
      - RUSTFS_SECRET_KEY=${RUSTFS_SECRET_KEY:-rustfsadmin}
      - RUSTFS_CONSOLE_ENABLE=true
    volumes:
      - rustfs-data:/data
      - rustfs-logs:/logs
    networks:
      - shellsight-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # Init container to create bucket using AWS CLI
  rustfs-init:
    image: amazon/aws-cli:latest
    container_name: shellsight-rustfs-init
    depends_on:
      rustfs:
        condition: service_healthy
    environment:
      - AWS_ACCESS_KEY_ID=${RUSTFS_ACCESS_KEY:-rustfsadmin}
      - AWS_SECRET_ACCESS_KEY=${RUSTFS_SECRET_KEY:-rustfsadmin}
      - AWS_DEFAULT_REGION=us-east-1
    entrypoint: >
      /bin/sh -c "
      aws --endpoint-url http://rustfs:9000 s3 mb s3://shellsight-recordings --region us-east-1 || true;
      echo 'Bucket created successfully';
      exit 0;
      "
    networks:
      - shellsight-network

  app:
    depends_on:
      rustfs:
        condition: service_healthy

volumes:
  rustfs-data:
  rustfs-logs:
EOF

    echo -e "${GREEN}✓ Created RustFS docker-compose override${NC}"
fi

echo
echo -e "${GREEN}Building and starting containers...${NC}"
echo

# Build and start with or without RustFS
if [ "$INSTALL_RUSTFS" = true ]; then
    $COMPOSE_CMD -f docker-compose.yml -f docker-compose.rustfs.yml up -d --build
else
    $COMPOSE_CMD up -d --build
fi

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

if [ "$INSTALL_RUSTFS" = true ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  RustFS (S3 Storage) Credentials${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo
    echo -e "${BLUE}Console URL:${NC}      http://localhost:9001"
    echo -e "${BLUE}Console Username:${NC} $RUSTFS_ACCESS_KEY"
    echo -e "${BLUE}Console Password:${NC} $RUSTFS_SECRET_KEY"
    echo
    echo -e "${BLUE}S3 Endpoint:${NC}      http://localhost:9000"
    echo -e "${BLUE}S3 Access Key:${NC}    $RUSTFS_ACCESS_KEY"
    echo -e "${BLUE}S3 Secret Key:${NC}    $RUSTFS_SECRET_KEY"
    echo -e "${BLUE}Bucket:${NC}           shellsight-recordings"
    echo
    echo -e "${YELLOW}IMPORTANT: Save these credentials! They are also stored in .env${NC}"
    echo
fi

echo "Useful commands:"
if [ "$INSTALL_RUSTFS" = true ]; then
    echo "  View logs:       $COMPOSE_CMD -f docker-compose.yml -f docker-compose.rustfs.yml logs -f"
    echo "  Stop:            $COMPOSE_CMD -f docker-compose.yml -f docker-compose.rustfs.yml down"
    echo "  Restart:         $COMPOSE_CMD -f docker-compose.yml -f docker-compose.rustfs.yml restart"
    echo "  Rebuild:         $COMPOSE_CMD -f docker-compose.yml -f docker-compose.rustfs.yml up -d --build"
else
    echo "  View logs:       $COMPOSE_CMD logs -f"
    echo "  Stop:            $COMPOSE_CMD down"
    echo "  Restart:         $COMPOSE_CMD restart"
    echo "  Rebuild:         $COMPOSE_CMD up -d --build"
fi
echo
