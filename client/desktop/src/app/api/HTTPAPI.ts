/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import path from 'path';
import fs from 'fs-extra';
import stream from 'stream';
import fetch from 'node-fetch';
import { promisify } from 'util';
import { app } from 'electron';
import type { IError } from '../../../../../shared/src/library/error/IError.ts';
import type { IApp } from '../IApp.ts';

export class HTTPAPI
{
    #_app:IApp;

    constructor(app:IApp)
    {
        this.#_app = app;
    }

    download = async (uri:string, options:Record<string, any>, filePath:string, fileName:string):Promise<Record<string, any> | IError> => 
    {
        console.log('Request:', decodeURIComponent(uri), options.body || '');
        
        if (!filePath) filePath = path.join(app.getPath('home'), '/Socrates/Downloads/');
        await fs.ensureDir(filePath);

        try 
        {
            options.headers['Origin'] = 'app://-';
            let response = await fetch(uri, options);

            if (!response.ok) this.#_app.throw(`unexpected response ${response.statusText}`, []);
            if (!response.headers || !response.headers.has('X-Json')) return await response.json() as Record<string, any>;

            let text = response.headers.get('X-Json') || '{}';
            let json = Buffer.from(text, 'base64').toString();

            let pipeline = promisify(stream.pipeline);
            await pipeline(response.body!, fs.createWriteStream(path.join(filePath, fileName)));

            fs.writeFileSync(path.join(filePath, fileName + '.meta'), json);

            let obj = JSON.parse(json);

            console.log('Response', decodeURIComponent(uri), obj);
            
            return obj; 
        }
        catch (error)
        {
            return this.#_app.warn(error, 'trouble downloading file: {}', [uri, options, filePath, fileName], {names:[HTTPAPI, this.download]});
        }
    };
}