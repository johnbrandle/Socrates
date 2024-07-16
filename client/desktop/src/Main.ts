/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import path from 'path';
import fs from 'fs-extra';
import { app } from 'electron';
import { Server as Server } from './library/Server.ts';
import config from '../../../shared/config.json';
import { FolderPath } from '../../../shared/src/library/file/Path.ts';
import { DevEnvironment } from '../../../shared/src/library/IEnvironment.ts';
import { App } from './app/App.ts';
import type { IApp } from './app/IApp.ts';

const isDebugMode = app.isPackaged === false;

const environment = globalThis.environment =
{
    frozen:
    {
        isPlainTextMode:false,
        isLocalhost:false,
        config:config,
        devEnvironment:isDebugMode === true ? DevEnvironment.Dev : DevEnvironment.Prod,
        isDebug:isDebugMode
    },

    isDevToolsOpen:undefined
};

export class Main
{
    #_contentPath!:FolderPath;
    #_dataPath!:FolderPath;

    #_app!:IApp;
    #_server!:Server;

    constructor()
    {
        //https://peter.sh/experiments/chromium-command-line-switches/
        app.commandLine.appendSwitch("disable-http-cache");
        //app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND , EXCLUDE localhost');
        app.commandLine.appendSwitch('disk-cache-dir', '/__null__/__null__');
        app.commandLine.appendSwitch('disk-cache-size', '0');
        app.commandLine.appendSwitch('media-cache-size', '0');
        app.commandLine.appendSwitch('aggressive-cache-discard');
        app.commandLine.appendSwitch('disable-application-cache');
        app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
        app.commandLine.appendSwitch('v8-cache-options', 'none');

        //ensure security warnings are enabled
        process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 'true';

        //parse command line arguments
        const args = process.argv.slice(2);
        for (let i = args.length; i--;)
        {
            let [key, value] = args[i].split('=');

            if (key !== '--contentPath') continue;

            //set the app content path
            this.#_contentPath = new FolderPath(path.join(__dirname, value) + '/');
        }
        if (this.#_contentPath === undefined) new Error('content path not found in command line arguments');

        //set the app data path
        this.#_dataPath = new FolderPath(path.join(app.getPath('home'), '/Socrates/'));
        fs.ensureDirSync(this.#_dataPath.toString());

        //create a server to serve the app (must be done before app is ready)
        this.#_server = new Server({contentPath:this.#_contentPath});

        //enable sandbox
        app.enableSandbox();

        //wait for the app to be ready
        app.whenReady().then(this.#ready);
    }

    #ready = async ():Promise<void> =>
    {
        try
        {
            const app = this.#_app = new App(environment, {server:this.#_server, contentPath:this.#_contentPath, dataPath:this.#_dataPath});
            await app.init();
        }
        catch (error)
        {
            console.log(this.constructor, error);

            app.quit();
        }
    }
}

new Main();