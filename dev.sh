#!/bin/bash
export PATH="/Users/kevindomenicomulone/.nvm/versions/node/v24.20.0/bin:$PATH"
cd "$(dirname "$0")"
exec npm run dev
