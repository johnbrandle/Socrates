@echo off
REM Get the current directory
set current_dir=%~dp0

REM Proxy Worker - Run dev to compile, start server, and watch
start cmd /k "cd %current_dir%server\worker\proxy && npm run dev && exit"

REM User Worker - Run d1 to generate db, dev to compile, start server, and watch
start cmd /k "cd %current_dir%server\worker\user && npm run d1 && npm run dev && exit"

REM Wallet Worker - Run d1 to generate db, dev to compile, start server, and watch
start cmd /k "cd %current_dir%server\worker\wallet && npm run d1 && npm run dev && exit"

REM Desktop/www/dev
start cmd /k "cd %current_dir%client\desktop\www && npm run dev && exit"

REM Web Pages
start cmd /k "cd %current_dir%client\desktop\www && npm run pages && exit"
