#!/bin/zsh
echo "/// 'npm run dev'      - compile a debug worker and watch for changes"
echo "/// 'npm run d1'       - create/update d1 local database"
echo "/// 'npm run publish'  - publish the worker to production"
echo
echo

cd "$(dirname "$0")"
exec /bin/zsh
