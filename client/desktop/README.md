# Packages html into a binary app

## IMPORTANT (if you run into a bug about electron properties being undefined)

1.  Execute "_printenv"_
2.  Check if there is a variable set called "ELECTRON_RUN_AS_NODE". If so, ...
3.  Execute "_unset ELECTRON_RUN_AS_NODE"_
4.  See this for more info: [_https://github.com/electron/electron-quick-start/issues/622_](https://github.com/electron/electron-quick-start/issues/622)

## Notes

- Maybe switch to Tauri one day: [https://tauri.app/](https://tauri.app/)

npm run dev - compiles the electron app ts code into javascript  
npm run electron-dev - executes the main js file (defined in package.json) launches app, and listens for changes
