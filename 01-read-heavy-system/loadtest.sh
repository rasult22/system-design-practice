#!/bin/bash
# Load test for Read-Heavy System
# Usage: ./loadtest.sh [connections] [duration]
# Example: ./loadtest.sh 1000 30

CONNECTIONS=${1:-100}
DURATION=${2:-30}
URL="http://localhost:3000/articles?page=1&limit=20"

echo "============================================"
echo "  Read-Heavy System - Load Test"
echo "============================================"
echo "URL:         $URL"
echo "Connections: $CONNECTIONS"
echo "Duration:    ${DURATION}s"
echo "============================================"
echo ""

npx autocannon -c $CONNECTIONS -d $DURATION "$URL"
