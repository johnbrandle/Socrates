#!/bin/bash

# Socrates setup 
# installs dependencies for dev and production

ARG1=$1
PROJECT_ROOT="$PWD"
SHARED="shared"
DESKTOP="client/desktop"
DESKTOP_WWW="client/desktop/www"
DESKTOP_WWW_BUILDER="client/desktop/www/builder"
SERVER_WORKER_ADMIN="server/worker/admin"
SERVER_WORKER_CLOUD="server/worker/cloud"
SERVER_WORKER_USER="server/worker/user"
SERVER_WORKER_WALLET="server/worker/wallet"
SERVER_WORKER_PROXY="server/worker/proxy"
SERVER_WORKER_SHARED="server/worker/shared"

# module list for setup
MODULES=()
MODULES+=($SHARED)
MODULES+=($DESKTOP)
MODULES+=($DESKTOP_WWW)
MODULES+=($DESKTOP_WWW_BUILDER)
# MODULES+=($SERVER_WORKER_ADMIN)
# MODULES+=($SERVER_WORKER_CLOUD)
MODULES+=($SERVER_WORKER_USER)
MODULES+=($SERVER_WORKER_WALLET)
MODULES+=($SERVER_WORKER_PROXY)
MODULES+=($SERVER_WORKER_SHARED)

RED="\e[31m"
CYAN="\e[96m"
ENDCOLOR="\e[0m"

# iterate modules and install its dependencies for each
for key in "${!MODULES[@]}"
do
    echo -e "${CYAN}                            ${ENDCOLOR}"
    echo -e "${CYAN}============================${ENDCOLOR}"
    echo -e "${CYAN}Installing dependencies: ${MODULES[$key]}${ENDCOLOR}"

    cd ./${MODULES[$key]}
    npm install
    cd $PROJECT_ROOT
done

echo -e "${CYAN}                            ${ENDCOLOR}"
echo -e "${CYAN}============================${ENDCOLOR}"
echo -e "${CYAN}Setup completed.${ENDCOLOR}"

# show how to run instructions?

# case "$ARG1" in
#     "case1")
#         echo "do something"
#     ;;
#     "case2")
#         echo "do something"
#     ;;
#     *)
#         echo "default" 
#     ;;
# esac