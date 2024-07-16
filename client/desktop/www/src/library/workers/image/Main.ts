/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ConfigUtil } from "../../../../../../../shared/src/library/utils/ConfigUtil.ts";
import { ConsoleUtil } from "../../../../../../../shared/src/library/utils/ConsoleUtil.ts";
import { StreamUtil } from "../../../../../../../shared/src/library/utils/StreamUtil.ts";
import { TypeUtil } from "../../../../../../../shared/src/library/utils/TypeUtil.ts";
import { BaseApp } from "../BaseApp.ts";
import type { IBaseApp } from "../IBaseApp.ts";
import { Worker, type Task } from "../Worker.ts"
import { ImageThumbnailTask, ImageBitmapTask } from "./Shared.ts";

const app = new (class extends BaseApp<IBaseApp<any>> 
{
    #_streamUtil:StreamUtil<any> | undefined;
    public override get streamUtil():StreamUtil<any> { return this.#_streamUtil ??= new StreamUtil<any>(this); }

    #_consoleUtil:ConsoleUtil<any> | undefined;
    public override get consoleUtil():ConsoleUtil<any> { return this.#_consoleUtil ??= new ConsoleUtil<any>(this, 'IMAGE WORKER'); }

    #_configUtil:ConfigUtil<any> | undefined;
    public override get configUtil():ConfigUtil<any> { return this.#_configUtil ??= new ConfigUtil<any>(this); }

    #_typeUtil:TypeUtil<any> | undefined;
    public override get typeUtil():TypeUtil<any> { return this.#_typeUtil ??= new TypeUtil<any>(this); }
})() as IBaseApp<any>;
type A = typeof app;

class Main extends Worker<A>
{
    protected async execute(task:Task):Promise<any>
    {   
        try
        {
            switch (task.name)
            {
                case ImageThumbnailTask.generate:
                {
                    const maxWidth = task.args.maxWidth as number;
                    const maxHeight = task.args.maxHeight as number;
                    const mimeType = task.args.mimeType as string;

                    const uint8Array = await this._app.streamUtil.toUint8Array(task.data as ReadableStream<Uint8Array>);
    
                    if (task.aborted === true) return;

                    const result = await this.#generateThumbnail(uint8Array, mimeType, maxWidth, maxHeight);
                    
                    if (task.aborted as boolean === true) return;

                    task.result = result;
                    break;
                }
                case ImageBitmapTask.generate:
                {
                    const mimeType = task.args.mimeType as string;
                    const maxWidth = task.args.maxWidth as number | undefined;
                    const maxHeight = task.args.maxHeight as number | undefined;

                    const uint8Array = await this._app.streamUtil.toUint8Array(task.data as ReadableStream<Uint8Array>);
    
                    if (task.aborted === true) return;

                    const result = await this.#generateBitmap(uint8Array, mimeType, maxWidth, maxHeight);
                    
                    if (task.aborted as boolean === true) return;

                    task.result = result;
                    break;
                }
                default:
                    console.warn('Unknown task:', task.name);
            }
        }
        catch(error) 
        {
            console.warn(error);
        }
        finally
        {
            this.end(task);
        }
    }

    async #generateThumbnail(uint8Array:Uint8Array, mimeType:string, maxWidth:number, maxHeight:number):Promise<ArrayBuffer | undefined>
    {
        //convert collected bytes into a Blob
        const blob = new Blob([uint8Array], {type:mimeType});
        
        //create a bitmap from the Blob
        const bitmap = await createImageBitmap(blob);

        let width = bitmap.width;
        let height = bitmap.height;

        //calculate new dimensions while maintaining aspect ratio
        const aspectRatio = width / height;
        if (width > maxWidth || height > maxHeight) 
        {
            if (aspectRatio > 1) //wider
            { 
               width = maxWidth;
               height = maxWidth / aspectRatio;
            } 
            else //taller
            { 
               height = maxHeight;
               width = maxHeight * aspectRatio;
            }
        }

        //use an OffscreenCanvas to create a thumbnail
        const thumbCanvas = new OffscreenCanvas(width, height);
        thumbCanvas.width = width;
        thumbCanvas.height = height;

        const context = thumbCanvas.getContext('2d') ?? undefined;
        if (context === undefined) 
        {
            console.warn('Could not get 2d context');
            return undefined;
        }

        //draw the image onto the canvas at the new dimensions
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        return (await thumbCanvas.convertToBlob()).arrayBuffer(); //convert the canvas to a Blob, then to an ArrayBuffer
    }

    async #generateBitmap(uint8Array:Uint8Array, mimeType:string, maxWidth?:number, maxHeight?:number):Promise<ImageBitmap | undefined>
    {
        //convert collected bytes into a Blob
        const blob = new Blob([uint8Array], {type: mimeType});
        
        //create a bitmap from the Blob
        const bitmap = await createImageBitmap(blob);

        let width = bitmap.width;
        let height = bitmap.height;

        maxWidth = maxWidth ?? width;
        maxHeight = maxHeight ?? height;

        if (width === maxWidth && height === maxHeight) return bitmap;

        //calculate new dimensions while maintaining aspect ratio
        const aspectRatio = width / height;
        if (width > maxWidth || height > maxHeight) 
        {
            if (aspectRatio > 1) //wider
            { 
               width = maxWidth;
               height = maxWidth / aspectRatio;
            } 
            else //taller
            { 
               height = maxHeight;
               width = maxHeight * aspectRatio;
            }
        }

        //use an OffscreenCanvas to create a thumbnail
        const thumbCanvas = new OffscreenCanvas(width, height);

        const context = thumbCanvas.getContext('2d') ?? undefined;
        if (context === undefined) 
        {
            console.warn('Could not get 2d context');
            return undefined;
        }

        //draw the image onto the canvas at the new dimensions
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        return thumbCanvas.transferToImageBitmap();
    }
}

new Main(app);