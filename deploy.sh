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
RUSTFS_ADMIN_USER=""
RUSTFS_ADMIN_PASSWORD=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --with-rustfs)
            INSTALL_RUSTFS=true
            shift
            ;;
        --rustfs-user)
            RUSTFS_ADMIN_USER="$2"
            shift 2
            ;;
        --rustfs-password)
            RUSTFS_ADMIN_PASSWORD="$2"
            shift 2
            ;;
        -h|--help)
            echo "ShellSight Deployment Script"
            echo ""
            echo "Usage: ./deploy.sh [options]"
            echo ""
            echo "Options:"
            echo "  --with-rustfs          Install RustFS (S3-compatible storage) alongside ShellSight"
            echo "  --rustfs-user USER     Set RustFS admin username (default: auto-generated)"
            echo "  --rustfs-password PASS Set RustFS admin password (default: auto-generated)"
            echo "  -h, --help             Show this help message"
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

    # Generate admin credentials if not provided
    if [ -z "$RUSTFS_ADMIN_USER" ]; then
        RUSTFS_ADMIN_USER="admin"
    fi

    if [ -z "$RUSTFS_ADMIN_PASSWORD" ]; then
        RUSTFS_ADMIN_PASSWORD=$(openssl rand -base64 16 2>/dev/null | tr -d '/+=' | head -c 16)
        if [ -z "$RUSTFS_ADMIN_PASSWORD" ]; then
            RUSTFS_ADMIN_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 16)
        fi
    fi

    # Generate access keys for S3
    RUSTFS_ACCESS_KEY=$(openssl rand -hex 10 2>/dev/null || head -c 20 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
    RUSTFS_SECRET_KEY=$(openssl rand -hex 20 2>/dev/null || head -c 40 /dev/urandom | base64 | tr -d '/+=' | head -c 40)

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
    if ! grep -q "RUSTFS_ROOT_USER" .env; then
        cat >> .env << EOF

# RustFS Configuration (auto-generated)
RUSTFS_ROOT_USER=$RUSTFS_ADMIN_USER
RUSTFS_ROOT_PASSWORD=$RUSTFS_ADMIN_PASSWORD
RUSTFS_ACCESS_KEY=$RUSTFS_ACCESS_KEY
RUSTFS_SECRET_KEY=$RUSTFS_SECRET_KEY
EOF
    fi

    echo -e "${GREEN}✓ Configured S3 settings for local RustFS${NC}"

    # Create docker-compose override for RustFS
    cat > docker-compose.rustfs.yml << 'EOF'
services:
  rustfs:
    image: minio/minio:latest
    container_name: shellsight-rustfs
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=${RUSTFS_ROOT_USER:-admin}
      - MINIO_ROOT_PASSWORD=${RUSTFS_ROOT_PASSWORD:-changeme}
    volumes:
      - rustfs-data:/data
    command: server /data --console-address ":9001"
    networks:
      - shellsight-network
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 30s
      timeout: 20s
      retries: 3

  # Init container to create bucket
  rustfs-init:
    image: minio/mc:latest
    container_name: shellsight-rustfs-init
    depends_on:
      rustfs:
        condition: service_healthy
    environment:
      - MINIO_ROOT_USER=${RUSTFS_ROOT_USER:-admin}
      - MINIO_ROOT_PASSWORD=${RUSTFS_ROOT_PASSWORD:-changeme}
      - ACCESS_KEY=${RUSTFS_ACCESS_KEY:-minioaccess}
      - SECRET_KEY=${RUSTFS_SECRET_KEY:-miniosecret}
    entrypoint: >
      /bin/sh -c "
      mc alias set myminio http://rustfs:9000 \$${MINIO_ROOT_USER} \$${MINIO_ROOT_PASSWORD};
      mc mb myminio/shellsight-recordings --ignore-existing;
      mc admin user add myminio \$${ACCESS_KEY} \$${SECRET_KEY};
      mc admin policy attach myminio readwrite --user \$${ACCESS_KEY};
      echo 'Bucket and user created successfully';
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
    echo -e "${BLUE}Admin Username:${NC}   $RUSTFS_ADMIN_USER"
    echo -e "${BLUE}Admin Password:${NC}   $RUSTFS_ADMIN_PASSWORD"
    echo
    echo -e "${BLUE}S3 Endpoint:${NC}      http://localhost:9000"
    echo -e "${BLUE}Access Key:${NC}       $RUSTFS_ACCESS_KEY"
    echo -e "${BLUE}Secret Key:${NC}       $RUSTFS_SECRET_KEY"
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
