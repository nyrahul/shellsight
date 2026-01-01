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
CLI_ADMIN_USER=""
CLI_ADMIN_PASSWORD=""
CLI_ACCESS_KEY=""
CLI_SECRET_KEY=""

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
        --admin-user)
            CLI_ADMIN_USER="$2"
            shift 2
            ;;
        --admin-password)
            CLI_ADMIN_PASSWORD="$2"
            shift 2
            ;;
        --access-key)
            CLI_ACCESS_KEY="$2"
            shift 2
            ;;
        --secret-key)
            CLI_SECRET_KEY="$2"
            shift 2
            ;;
        -h|--help)
            echo "RustFS Deployment Script"
            echo ""
            echo "Usage: ./deploy-rustfs.sh [options]"
            echo ""
            echo "Options:"
            echo "  --uninstall            Uninstall RustFS and all components"
            echo "  -y, --yes              Auto-answer yes to all prompts (for uninstall)"
            echo "  --admin-user USER      Set RustFS admin username (default: admin)"
            echo "  --admin-password PASS  Set RustFS admin password (auto-generated if not provided)"
            echo "  --access-key KEY       Set S3 access key for app access (auto-generated if not provided)"
            echo "  --secret-key SECRET    Set S3 secret key for app access (auto-generated if not provided)"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Credentials are auto-generated during installation unless specified via CLI."
            echo ""
            echo "After installation, use the S3 credentials in your ShellSight .env file:"
            echo "  S3_ENDPOINT=http://<rustfs-host>:9000"
            echo "  S3_ACCESS_KEY=<access-key>"
            echo "  S3_SECRET_KEY=<secret-key>"
            echo "  S3_BUCKET=shellsight-recordings"
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
    echo -e "${RED}  RustFS Uninstall${NC}"
    echo -e "${RED}========================================${NC}"
    echo

    echo -e "${YELLOW}This will remove all RustFS containers and networks.${NC}"
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
    echo -e "${BLUE}Stopping and removing containers...${NC}"

    if [ -f docker-compose.rustfs.yml ]; then
        $COMPOSE_CMD -f docker-compose.rustfs.yml down --remove-orphans 2>/dev/null || true
    fi

    echo -e "${GREEN}✓ Containers and networks removed${NC}"

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
        if [ -f docker-compose.rustfs.yml ]; then
            $COMPOSE_CMD -f docker-compose.rustfs.yml down -v 2>/dev/null || true
        fi
        docker volume rm rustfs-data 2>/dev/null || true
        echo -e "${GREEN}✓ Volumes removed${NC}"
    fi

    # Ask about config files
    echo
    echo -e "${YELLOW}Do you want to remove configuration files (.env.rustfs, docker-compose.rustfs.yml)?${NC}"
    if [ "$AUTO_YES" = true ]; then
        remove_config="y"
    else
        read -p "Remove config files? [y/N]: " remove_config
    fi
    if [[ "$remove_config" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Removing configuration files...${NC}"
        rm -f .env.rustfs docker-compose.rustfs.yml 2>/dev/null || true
        echo -e "${GREEN}✓ Configuration files removed${NC}"
    fi

    echo
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Uninstall Complete${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo
    echo "RustFS has been uninstalled."
    exit 0
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  RustFS Deployment Script${NC}"
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

# Generate credentials
echo -e "${BLUE}Setting up RustFS credentials...${NC}"

# Admin credentials
if [ -n "$CLI_ADMIN_USER" ]; then
    RUSTFS_ADMIN_USER="$CLI_ADMIN_USER"
else
    RUSTFS_ADMIN_USER="admin"
fi

if [ -n "$CLI_ADMIN_PASSWORD" ]; then
    RUSTFS_ADMIN_PASSWORD="$CLI_ADMIN_PASSWORD"
else
    RUSTFS_ADMIN_PASSWORD=$(openssl rand -base64 16 2>/dev/null | tr -d '/+=' | head -c 16)
    if [ -z "$RUSTFS_ADMIN_PASSWORD" ]; then
        RUSTFS_ADMIN_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 16)
    fi
fi

# S3 access credentials (separate from admin)
if [ -n "$CLI_ACCESS_KEY" ]; then
    S3_ACCESS_KEY="$CLI_ACCESS_KEY"
else
    S3_ACCESS_KEY=$(openssl rand -hex 10 2>/dev/null)
    if [ -z "$S3_ACCESS_KEY" ]; then
        S3_ACCESS_KEY=$(head -c 20 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
    fi
fi

if [ -n "$CLI_SECRET_KEY" ]; then
    S3_SECRET_KEY="$CLI_SECRET_KEY"
else
    S3_SECRET_KEY=$(openssl rand -base64 32 2>/dev/null | tr -d '/+=' | head -c 40)
    if [ -z "$S3_SECRET_KEY" ]; then
        S3_SECRET_KEY=$(head -c 40 /dev/urandom | base64 | tr -d '/+=' | head -c 40)
    fi
fi

echo -e "${GREEN}✓ Credentials generated${NC}"

# Save credentials to .env.rustfs
cat > .env.rustfs << EOF
# RustFS Configuration (auto-generated)
# Generated on: $(date)

# Admin credentials (for RustFS console login)
RUSTFS_ADMIN_USER=$RUSTFS_ADMIN_USER
RUSTFS_ADMIN_PASSWORD=$RUSTFS_ADMIN_PASSWORD

# S3 access credentials (write-only access key for admin user)
# This access key is visible in the RustFS console under Access Keys
S3_ACCESS_KEY=$S3_ACCESS_KEY
S3_SECRET_KEY=$S3_SECRET_KEY
S3_BUCKET=shellsight-recordings
EOF

echo -e "${GREEN}✓ Saved credentials to .env.rustfs${NC}"

# Create docker-compose.rustfs.yml
cat > docker-compose.rustfs.yml << 'EOF'
services:
  rustfs:
    image: rustfs/rustfs:latest
    container_name: rustfs
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      RUSTFS_ACCESS_KEY: ${RUSTFS_ADMIN_USER:-admin}
      RUSTFS_SECRET_KEY: ${RUSTFS_ADMIN_PASSWORD:-changeme}
      RUSTFS_CONSOLE_ENABLE: "true"
    volumes:
      - rustfs-data:/data
    healthcheck:
      test: ["CMD-SHELL", "nc -z localhost 9000 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 10s

  # Init container to create bucket and access key
  rustfs-init:
    image: minio/mc:latest
    container_name: rustfs-init
    depends_on:
      rustfs:
        condition: service_healthy
    environment:
      RUSTFS_ADMIN_USER: ${RUSTFS_ADMIN_USER:-admin}
      RUSTFS_ADMIN_PASSWORD: ${RUSTFS_ADMIN_PASSWORD:-changeme}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        # Connect with admin credentials
        mc alias set rustfs http://rustfs:9000 $${RUSTFS_ADMIN_USER} $${RUSTFS_ADMIN_PASSWORD}

        # Create bucket
        mc mb rustfs/shellsight-recordings --ignore-existing

        # Create write-only policy for the bucket
        cat > /tmp/writeonly-policy.json << 'POLICY'
        {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": [
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:GetBucketLocation"
              ],
              "Resource": [
                "arn:aws:s3:::shellsight-recordings",
                "arn:aws:s3:::shellsight-recordings/*"
              ]
            }
          ]
        }
        POLICY

        # Create the policy in RustFS
        mc admin policy create rustfs writeonly /tmp/writeonly-policy.json || true

        # Create a service account (access key) for admin user with write-only policy
        mc admin user svcacct add rustfs $${RUSTFS_ADMIN_USER} \
          --access-key $${S3_ACCESS_KEY} \
          --secret-key $${S3_SECRET_KEY} \
          --policy /tmp/writeonly-policy.json || true

        echo 'Bucket and write-only access key created successfully'

volumes:
  rustfs-data:
EOF

echo -e "${GREEN}✓ Created docker-compose.rustfs.yml${NC}"

echo
echo -e "${GREEN}Starting RustFS...${NC}"
echo

# Start RustFS
$COMPOSE_CMD -f docker-compose.rustfs.yml --env-file .env.rustfs up -d

# Wait for init to complete
echo
echo -e "${BLUE}Waiting for initialization to complete...${NC}"
sleep 5

# Check if rustfs-init completed
if docker ps -a --format '{{.Names}} {{.Status}}' | grep -q "rustfs-init.*Exited (0)"; then
    echo -e "${GREEN}✓ Initialization complete${NC}"
else
    echo -e "${YELLOW}Note: Check 'docker logs rustfs-init' if bucket creation failed${NC}"
fi

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  RustFS Admin Credentials${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo -e "${BLUE}Console URL:${NC}      http://localhost:9001"
echo -e "${BLUE}Admin Username:${NC}   $RUSTFS_ADMIN_USER"
echo -e "${BLUE}Admin Password:${NC}   $RUSTFS_ADMIN_PASSWORD"
echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  S3 Write-Only Access Key${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo -e "${BLUE}S3 Endpoint:${NC}      http://localhost:9000"
echo -e "${BLUE}Access Key:${NC}       $S3_ACCESS_KEY"
echo -e "${BLUE}Secret Key:${NC}       $S3_SECRET_KEY"
echo -e "${BLUE}Bucket:${NC}           shellsight-recordings"
echo -e "${BLUE}Policy:${NC}           write-only (PutObject, DeleteObject)"
echo
echo -e "${YELLOW}This access key is visible in the RustFS console under Access Keys${NC}"
echo -e "${YELLOW}Credentials are also stored in .env.rustfs${NC}"
echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ShellSight Configuration${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo "Add these to your ShellSight .env file:"
echo
echo "  S3_ENDPOINT=http://<rustfs-host>:9000"
echo "  S3_ACCESS_KEY=$S3_ACCESS_KEY"
echo "  S3_SECRET_KEY=$S3_SECRET_KEY"
echo "  S3_BUCKET=shellsight-recordings"
echo
echo "If ShellSight is on the same host, use:"
echo "  S3_ENDPOINT=http://host.docker.internal:9000"
echo
echo "Useful commands:"
echo "  View logs:       $COMPOSE_CMD -f docker-compose.rustfs.yml logs -f"
echo "  Stop:            $COMPOSE_CMD -f docker-compose.rustfs.yml down"
echo "  Restart:         $COMPOSE_CMD -f docker-compose.rustfs.yml restart"
echo
