#!/bin/zsh

# Get the current directory
current_dir="$(dirname "$0")"
echo $current_dir
# AppleScript to open a new terminal window, run the command in the current directory, and then start a new Zsh shell

# WEB - run pages and dev to run the http server, compile, and watch
#osascript <<EOD
#  tell application "Terminal"
#
#    set newWindow1 to do script "cd '$current_dir'/client/www; npm run pages; exec /bin/zsh"
#    set custom title of newWindow1 to "web pages"
#    activate
    
#    set newWindow2 to do script "cd '$current_dir'/client/www; npm run dev; exec /bin/zsh"
#    set custom title of newWindow2 to "web dev"
#    activate
    
#  end tell
#EOD

# PROXY WORKER - run dev to compile, start server, and watch
osascript <<EOD
  tell application "Terminal"
      
    set newWindow3 to do script "cd '$current_dir'/server/worker/proxy; npm run dev; exec /bin/zsh"
    set custom title of newWindow3 to "workers/p dev"
    activate
    
  end tell
EOD

# USER WORKER - run d1 to generate db, dev to compile, start server, and watch
osascript <<EOD
  tell application "Terminal"
    
    set newWindow4 to do script "cd '$current_dir'/server/worker/user; npm run d1; npm run dev; exec /bin/zsh"
    set custom title of newWindow4 to "workers/u dev"
    activate
    
  end tell
EOD

# WALLET WORKER - run d1 to generate db, dev to compile, start server, and watch
osascript <<EOD
  tell application "Terminal"
    
    set newWindow6 to do script "cd '$current_dir'/server/worker/wallet; npm run d1; npm run dev; exec /bin/zsh"
    set custom title of newWindow6 to "workers/w dev"
    activate
    
  end tell
EOD

# ELECTRON - run electron-dev to compile electron source code and watch for changes to electron source code. run dev to run electron app and watch for electron recompile or web recompile, and relaunch electron app automatically 
osascript <<EOD
  tell application "Terminal"

    set newWindow8 to do script "cd '$current_dir'/client/desktop; npm run electron-dev; exec /bin/zsh"
    set custom title of newWindow8 to "desktop/electron-dev"
    activate
    
    set newWindow7 to do script "cd '$current_dir'/client/desktop; npm run dev; exec /bin/zsh"
    set custom title of newWindow7 to "desktop/dev"
    activate

  end tell
EOD

osascript <<EOD
  tell application "Terminal"

    set newWindow7 to do script "cd '$current_dir'/client/desktop/www; npm run dev; exec /bin/zsh"
    set custom title of newWindow7 to "desktop/www/dev"
    activate
    
    
    set newWindow1 to do script "cd '$current_dir'/client/desktop/www; npm run pages; exec /bin/zsh"
    set custom title of newWindow1 to "web pages"
    activate

  end tell
EOD