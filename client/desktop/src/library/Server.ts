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
 * For full license text of the original code, refer to the LICENSE file or https://github.com/sindresorhus/electron-serve
*/

import { BrowserWindow, net } from "electron";
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import electron from 'electron';
import url from 'url';
import { ErrorCode } from "../../../../shared/src/app/json/ErrorJSON.ts";
import type { uid } from "../../www/src/library/utils/UIDUtil.ts";
import type { FolderPath } from "../../../../shared/src/library/file/Path.ts";
import { DevEnvironment } from "../../../../shared/src/library/IEnvironment.ts";
import type { IApp } from "../app/IApp.ts";

const stat = promisify(fs.stat);

interface ServerOptions
{
    isCorsEnabled?:boolean;
    scheme?:string;
    contentPath:FolderPath;
}

export class Server
{
    #_app!:IApp;
    #_options:ServerOptions;

    #_contentDirectory!:string;

    #_initialized = false;

    constructor(options:ServerOptions)
    {
        this.#_options = options;

        electron.protocol.registerSchemesAsPrivileged(
        [{
            scheme: this.#_options.scheme || 'app',
            privileges: 
            {
                standard:true,
                secure:true,
                bypassCSP:false,
                allowServiceWorkers:true,
                supportFetchAPI:true,
                corsEnabled:this.#_options.isCorsEnabled || true,
                stream:true,
                codeCache:true
            }
        }]);

        this.#_contentDirectory = path.resolve(electron.app.getAppPath(), this.#_options.contentPath.toString());
    }

    public init(app:IApp)
    {
        this.#_app = app;
    }

    public loadURL(browserWindow:BrowserWindow, query:string):Promise<void>
    {
        if (this.#_initialized === false)
        {
            this.#_initialized = true;
            
            this.#_app.session.protocol.handle(this.#_options.scheme || 'app', this.#onRequest);
        }

        return browserWindow.loadURL(`${this.#_options.scheme || 'app'}://-${query}`);
    }

    #onRequest = async (request:GlobalRequest):Promise<GlobalResponse> => //serve files, and merge csp if serving html
    {
        //base directory of the bundled app content we want to serve
        const contentDirectory = this.#_contentDirectory;

        const requestURL = new URL(request.url);
        
        let pathname = path.join(contentDirectory, decodeURIComponent(requestURL.pathname));
        if (pathname.indexOf('.') === -1) 
        {
            //if no file extension, assume it's a directory and try to serve index.html
            //serve assistant.html instead if we are in debug mode and the request is not coming from the assistant
            pathname = path.join(contentDirectory, this.#_app.environment.frozen.isDebug && requestURL.searchParams.has('assistant') !== true ? '/assistant.html' : '/index.html');
        }

        const fileExtension = path.extname(pathname).toLowerCase();
        
        //for HTTP API requests
        if (fileExtension === '.api')
        {
            try
            {
                //extract the path from the json
                const json = await this.#_app.responseUtil.extract<{path:string[], key:uid}>(request);
                if (json instanceof Response) return json;

                //let the api handle the rest
                return this.#_app.extractOrRethrow(await this.#_app.apiManager.handleRequest(json.key, json.path, request.body ?? undefined));
            }
            catch (error)
            {
                return this.#_app.responseUtil.error({error:ErrorCode.GLOBAL_INVALID_REQUEST, details:request.url}, error);
            }
        }

        if (pathname.startsWith(contentDirectory) !== true || fs.existsSync(pathname) === false) return new Response("not found: " + pathname, {status:404});

        switch (fileExtension)
        {
            case '.html':
            {
                const contents = fs.readFileSync(pathname, {encoding:'utf8'});

                const [csp, uint8Array] = this.#_app.cspUtil.merge(fileExtension, this.#_app.cspUtil.base, this.#_app.textUtil.toUint8Array(contents));
    
                const cspString = this.#_app.cspUtil.toString(csp, DevEnvironment.Dev);
                const response = new Response(uint8Array, {status:200});

                if (this.#_app.environment.frozen.devEnvironment === DevEnvironment.Prod) response.headers.set('content-security-policy', cspString);
                
                response.headers.set('service-worker-allowed', '/');
                response.headers.set('cross-origin-opener-policy', 'same-origin');
                response.headers.set('cross-origin-embedder-policy', 'require-corp');
                response.headers.set('content-type', 'text/html');

                return response;
            }
            case '.js':
            {
                const contents = fs.readFileSync(pathname, {encoding:'utf8'});

                const response = new Response(this.#_app.textUtil.toUint8Array(contents), {status:200});
                response.headers.set('service-worker-allowed', '/');
                response.headers.set('cross-origin-opener-policy', 'same-origin');
                response.headers.set('cross-origin-embedder-policy', 'require-corp');
                response.headers.set('content-type', 'application/javascript');
                
                return response;
            }
            default:
                return net.fetch(url.pathToFileURL(pathname).toString());
        }        
    }
};