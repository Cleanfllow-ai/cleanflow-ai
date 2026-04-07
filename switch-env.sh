#!/bin/bash
# Usage: ./switch-env.sh <environment>
# Example: ./switch-env.sh prod
#          ./switch-env.sh dev

ENV_NAME=$1

if [ -z "$ENV_NAME" ]; then
  echo "Usage: ./switch-env.sh <environment>"
  echo "Available environments:"
  for f in .env.*; do
    name="${f#.env.}"
    if [ "$name" != "local" ] && [ "$name" != "example" ]; then
      echo "  - $name"
    fi
  done
  exit 1
fi

ENV_FILE=".env.${ENV_NAME}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

cp "$ENV_FILE" .env.local
echo "Switched to '$ENV_NAME' environment (.env.local updated)"
echo "Restart the dev server for changes to take effect."
