/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import https from 'https';
import { webContents as WebContents } from 'electron';
import type { IError } from '../../../../../shared/src/library/error/IError.ts';
import type { IApp } from '../IApp.ts';

export class WebViewAPI
{
    #_app:IApp;

    constructor(app:IApp)
    {
        this.#_app = app;
    }

    makeScreenshotOfWebContents = async (webContentsID:number):Promise<Uint8Array | IError> =>
    {
        try
        {
            const contents = WebContents.fromId(webContentsID);
            if (!contents) this.#_app.throw('webContents not found', [webContentsID]);

            const buffer = await contents.capturePage();

            return buffer.toJPEG(85);
        }
        catch (error)
        {
            return this.#_app.warn(error, 'failed to make screenshot of webContents', [webContentsID], {errorOnly:true, names:[WebViewAPI, this.makeScreenshotOfWebContents]});
        }
    };

    downloadFileFromWebContents = async (webContentsID:number, url:string):Promise<ReadableStream<Uint8Array> | IError> => 
    {
        try
        {
            const webContents = WebContents.fromId(webContentsID);
            if (webContents === undefined) this.#_app.throw('webContents not found', [webContentsID, url]);

            const cookies = await webContents.session.cookies.get({});
            const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

            const options = {headers:{'Cookie':cookieString}};

            const [readableStream, controller] = this.#_app.streamUtil.create();

            https.get(url, options, (response) => 
            {
                response.on('data', (chunk) => 
                {
                    controller.enqueue(chunk);
                });
        
                response.on('end', () => 
                {
                    controller.close();
                });
            }).on('error', (error) => 
            {
                controller.error(this.#_app.warn(error, 'failed to download file from webContents', [webContentsID, url], {errorOnly:true, names:[WebViewAPI, this.downloadFileFromWebContents]}));
            });

            return readableStream;
        }
        catch (error)
        {
            return this.#_app.warn(error, 'failed to download file from webContents', [webContentsID, url], {errorOnly:true, names:[WebViewAPI, this.downloadFileFromWebContents]});
        }
    };
}