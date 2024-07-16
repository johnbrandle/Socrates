/*
https://github.com/sindresorhus/electron-reloader

electron_watcher.js:

MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

'use strict';

import path from 'path';
import electron from 'electron';
import chokidar from 'chokidar';
import type { folderpath } from '../../../../../shared/src/library/file/Path';
import type { IBaseApp } from '../IBaseApp';

type WatcherOptions =
{
    ignore?:Array<string>,
}

export class FileMonitorAssistant<A extends IBaseApp<A>>
{   
    #_app:A;

    #_rootDir:folderpath;
    #_mainProcessDir:folderpath;
    #_onAppFileChanged:(app:Electron.App) => boolean;
    #_onWindowFileChanged:(window:Electron.BrowserWindow) => void;
    #_options:WatcherOptions;

    #_watcher!:chokidar.FSWatcher;

    constructor(app:A, rootDir:folderpath, mainProcessDir:folderpath, onAppFileChanged:(app:Electron.App) => boolean, onWindowFileChanged:(window:Electron.BrowserWindow) => void, options:WatcherOptions)
    {
        this.#_app = app;
        this.#_rootDir = rootDir;
        this.#_mainProcessDir = mainProcessDir;
        this.#_onAppFileChanged = onAppFileChanged;
        this.#_onWindowFileChanged = onWindowFileChanged;
        this.#_options = options;

        this.#init();
    }

    #init()
    {
        const watcher = this.#_watcher = chokidar.watch([this.#_rootDir, this.#_mainProcessDir], 
        {
            cwd:this.#_rootDir,
            disableGlobbing: true,
            ignored:
            [
                /(^|[/\\])\../, //dotfiles
                'node_modules',
                '**/*.map',
                '**/*.ts'
            ].concat(this.#_options.ignore || [])
        });

        watcher.on('ready', this.#onReady);
        watcher.on('change', this.#onChange);

        electron.app.on('quit', this.#onQuit);
    }

    #onReady = () =>
    {
        this.#_app.consoleUtil.log(this.constructor, 'Watcher ready'); //ConsoleUtil.log('Watched paths:', inspect(watcher.getWatched(), {compact: false, colors: true}));
    }

    #onChange = (filePath:string) =>
    {
        const fullFilePath = path.join(this.#_rootDir, filePath);

        this.#_app.consoleUtil.log(this.constructor, 'File changed:', fullFilePath);

        if (fullFilePath.indexOf(this.#_mainProcessDir) != -1)
        {
            const stop = this.#_onAppFileChanged(electron.app);
            if (stop === true) this.#_watcher.close();

            return;
        } 
        
        for (const window of electron.BrowserWindow.getAllWindows()) this.#_onWindowFileChanged(window); //for (const view of window.getBrowserViews()) callback(view);//view.webContents.reloadIgnoringCache();
    }

    #onQuit = () =>
    {
        this.#_watcher.close();
    }
}