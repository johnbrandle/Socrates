/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IDatable } from "../../../../../../shared/src/library/data/IDatable.ts";
import type { IBaseApp } from "../IBaseApp.ts";
import type { IAbortable } from "../../../../../../shared/src/library/abort/IAbortable.ts";
import { ImageThumbnailWorkerController } from "../workers/image/ImageThumbnailWorkerController.ts";
import { ImageBitmapWorkerController } from "../workers/image/ImageBitmapWorkerController.ts";
import type { IAborted } from '../../../../../../shared/src/library/abort/IAborted.ts';
import type { IError } from '../../../../../../shared/src/library/error/IError.ts';
import { AbortableHelper } from '../../../../../../shared/src/library/helpers/AbortableHelper.ts';

type MetaData = {width:number, height:number, duration:number};

@SealedDecorator()
export class ImageUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public async getMetadata(blob:Blob):Promise<MetaData | undefined | IAborted | IError>;
    public async getMetadata(uint8Array:Uint8Array, contentType:string):Promise<MetaData | undefined | IAborted | IError>;
    public async getMetadata(stream:ReadableStream<Uint8Array>, contentType:string):Promise<MetaData | undefined | IAborted | IError>;
    public async getMetadata(stream:ReadableStream<Uint8Array> | Uint8Array | Blob, contentType?:string)
    {
        return undefined;
    }

    public async getThumbnail(streamable:IDatable<ReadableStream<Uint8Array>>, mimeType:string, maxWidth:number, maxHeight:number, abortable:IAbortable):Promise<Blob | undefined | IAborted | IError>
    {
        let workerController:ImageThumbnailWorkerController<any> | undefined;

        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

            workerController = new ImageThumbnailWorkerController(this._app, this._app, abortable);

            const uint8Array = _.value(await workerController.generateThumbnail(streamable, maxWidth, maxHeight, mimeType));
            if (uint8Array === undefined) return undefined;

            return new Blob([uint8Array], {type:mimeType});
        }
        catch (error)
        {
            return this._app.warn(error, 'Error generating thumbnail', arguments, {names:[ImageUtil, this.getThumbnail]});
        }
        finally
        {
            workerController?.dnit();
        }
    }

    public async getBitmap(streamable:IDatable<ReadableStream<Uint8Array>>, mimeType:string, abortable:IAbortable, maxWidth?:number, maxHeight?:number):Promise<ImageBitmap | undefined | IAborted | IError>
    {
        let workerController:ImageBitmapWorkerController<any> | undefined;

        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

            workerController = new ImageBitmapWorkerController(this._app, this._app, abortable);

            return _.value(await workerController.generateBitmap(streamable, mimeType, maxWidth, maxHeight));
        }
        catch (error)
        {
            return this._app.warn(error, 'Error generating bitmap', arguments, {names:[ImageUtil, this.getBitmap]});
        }
        finally
        {
            workerController?.dnit();
        }
    }
}
