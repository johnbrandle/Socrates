#!/bin/zsh
echo "/// 'npm run dev'                 - compile a debug build and watch for changes"
echo "/// 'npm run electron-dev'        - run electron app and watch for changes (auto refresh app on change to js files)"
echo "/// 'npm run electron-dev-log'    - run electron app, watch for changes (auto refresh app on change to js files), and log"
echo
echo

cd "$(dirname "$0")"
exec /bin/zsh
