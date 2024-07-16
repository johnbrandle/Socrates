#!/bin/zsh
echo "/// 'npm run pages'               - compile cloudflare pages and run it locally"
echo "/// 'npm run dev'                 - compile a debug build and watch for changes"
echo "/// 'npm run prod'                - compile a production build"
echo
echo

cd "$(dirname "$0")"
exec /bin/zsh
