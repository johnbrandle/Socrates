#!/bin/zsh
echo "/// 'npm run dev'      - compile a debug worker and watch for changes"
echo "/// 'npm run publish'  - publish the worker to production"
echo
echo

cd "$(dirname "$0")"
exec /bin/zsh
