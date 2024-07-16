/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @license
 * 
 * The code from which this code's implementation is derived is licensed under the:
 * 
 * MIT License 
 * 
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 * 
 * For full license text of the original code, refer to the LICENSE file or https://github.com/sindresorhus/electron-store
*/

import path from 'path';
import {app, ipcMain, shell} from 'electron';
import Conf from 'conf';

export class Store extends Conf
{
    static isInitialized = false;

    constructor(options:any)
    {
        const {defaultCwd, appVersion} = Store.initDataListener();
        
        options = {name:'config', ...options};

        if (!options.projectVersion) options.projectVersion = appVersion;
        
        if (options.cwd) options.cwd = path.isAbsolute(options.cwd) ? options.cwd : path.join(defaultCwd, options.cwd);
        else options.cwd = defaultCwd;
        
        options.configName = options.name;
        delete options.name;

        super(options);
    }

    //set up the `ipcMain` handler for communication between renderer and main process.
    private static initDataListener = () => 
    {
        const appData = {defaultCwd:app.getPath('userData'), appVersion:app.getVersion()};

        if (Store.isInitialized === true) return appData;
        
        ipcMain.on('electron-store-get-data', event => { event.returnValue = appData; });

        Store.isInitialized = true;

        return appData;
    };

    public openInEditor() 
    {
        shell.openPath(this.path);
    }
}