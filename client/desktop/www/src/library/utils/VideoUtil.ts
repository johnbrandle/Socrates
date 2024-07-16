/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IDatable } from "../../../../../../shared/src/library/data/IDatable.ts";
import { VideoThumbnailWorkerController } from "../workers/video/VideoThumbnailWorkerController.ts";
import type { IBaseApp } from "../IBaseApp.ts";
import type { IAbortable } from "../../../../../../shared/src/library/abort/IAbortable.ts";
import { ResolvePromise } from "../../../../../../shared/src/library/promise/ResolvePromise.ts";
import { VideoTranscodeWorkerController } from "../workers/video/VideoTranscodeWorkerController.ts";
import type { IError } from '../../../../../../shared/src/library/error/IError.ts';
import { AbortableHelper } from '../../../../../../shared/src/library/helpers/AbortableHelper.ts';
import type { IAborted } from '../../../../../../shared/src/library/abort/IAborted.ts';

type MetaData = {width:number, height:number, duration:number};

@SealedDecorator()
export class VideoUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public async getMetadata(blob:Blob):Promise<MetaData | undefined | IError>;
    public async getMetadata(uint8Array:Uint8Array, contentType:string):Promise<MetaData | undefined | IError>;
    public async getMetadata(stream:ReadableStream<Uint8Array>, contentType:string):Promise<MetaData | undefined | IError>;
    public async getMetadata(stream:ReadableStream<Uint8Array> | Uint8Array | Blob, contentType?:string)
    {
        try
        {
            const promise = new ResolvePromise<MetaData | undefined>();

            let blob:Blob;
            if (this._app.typeUtil.is<ReadableStream<Uint8Array>>(stream, ReadableStream)) 
            {
                const uint8Array = this._app.extractOrRethrow(await this._app.streamUtil.toUint8Array(stream));
                blob = new Blob([uint8Array], {type:contentType});
            }
            else if (this._app.typeUtil.is<Uint8Array>(stream, Uint8Array)) blob = new Blob([stream], {type:contentType});
            else blob = stream;

            const video = document.createElement('video');
            video.muted = true;
            const url = URL.createObjectURL(blob);
            
            const destroy = () =>
            {
                video.removeEventListener('loadedmetadata', onLoadedMetadata);
                video.removeEventListener('error', onError);

                video.pause();
                video.currentTime = 0;
                video.removeAttribute('src');
                video.load();
                URL.revokeObjectURL(url);
            }

            const onLoadedMetadata = () =>
            {
                const width = video.videoWidth;
                const height = video.videoHeight;
                const duration = video.duration;
            
                destroy();

                promise.resolve({width, height, duration});
            }

            const onError = () =>
            {
                destroy();

                promise.resolve(undefined);
            }

            video.addEventListener('loadedmetadata', onLoadedMetadata);
            video.addEventListener('error', onError);

            video.src = url;

            return promise;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get video metadata', arguments, {errorOnly:true, names:[VideoUtil, this.getMetadata]});
        }
    }

    public async getScreenshot(streamable:IDatable<ReadableStream<Uint8Array>>, mimeType:string, abortable:IAbortable):Promise<Blob | undefined | IAborted | IError>
    {
        let workerController:VideoThumbnailWorkerController<any> | undefined;

        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

            workerController = new VideoThumbnailWorkerController(this._app, this._app, abortable);

            const data = _.value(await workerController.generateThumbnail(streamable));
            if (data === undefined) return undefined;

            const blob = new Blob([data], {type:'video/mp4'});
            
            return _.value(await this._getScreenshot(blob));
        }
        catch (error)
        {
            return this._app.warn(error,'Failed to get screenshot', arguments, {names:[VideoUtil, this.getScreenshot]});
        }
        finally
        {
            workerController?.dnit();
        }
    }

    private async _getScreenshot(blob:Blob, time:number=-1):Promise<Blob | undefined>    
    {
        const promise = new ResolvePromise<Blob | undefined>();

        const video = document.createElement('video');
        video.muted = true;
        const url = URL.createObjectURL(blob);

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) 
        {
            this._app.consoleUtil.warn(VideoUtil, "Could not get canvas context");
            return undefined;
        }

        const destroy = () =>
        {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener("loadeddata", onLoadedData);
            video.removeEventListener("seeked", onSeeked);
            video.removeEventListener("error", onError);

            video.pause();
            video.currentTime = 0;
            video.removeAttribute('src');
            video.load();
            URL.revokeObjectURL(url);
        }

        const onLoadedMetadata = () =>
        {
            const duration = video.duration;

            if (time === -1) time = duration * .90;
        }

        const onLoadedData = () =>
        {
            if (time === -1)
            {
                destroy();

                promise.resolve(undefined);
                return;
            }

            video.currentTime = time;
        }

        const onSeeked = () =>
        {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
            destroy();

            canvas.toBlob((blob:Blob | null) => 
            {
                promise.resolve(blob ?? undefined);
            }, "image/jpeg", 0.95);
        }

        const onError = () =>
        {
            destroy();

            promise.resolve(undefined);
        }

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener("loadeddata", onLoadedData);
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("error", onError);

        video.src = url;

        return promise;
    }

    public async transcode(streamable:IDatable<ReadableStream<Uint8Array>>, mimeType:string, abortable:IAbortable):Promise<Blob | undefined | IAborted | IError>
    {
        let workerController:VideoTranscodeWorkerController<any> | undefined;

        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

            workerController = new VideoTranscodeWorkerController(this._app, this._app, abortable);

            const data = _.value(await workerController.transcode(streamable));
            if (data === undefined) return undefined;

            return new Blob([data], {type:'video/mp4'});
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to transcode video', arguments, {names:[VideoUtil, this.transcode]});
        }
        finally
        {
            workerController?.dnit();
        }
    }

    /*
    public getVideoMetadata = async (video:ReadableStream<Uint8Array>, contentType:string):Promise<MetaData | undefined> =>
    {
        const [promise, callback] = this._app.promiseUtil.promise<MetaData | undefined>();

        let breakEarly = false;

        switch (contentType)
        {
            case 'video/mp4':
                let mp4boxFile = MP4Box.createFile();
                
                mp4boxFile.onReady = (info:any) => 
                {
                    breakEarly = true;

                    const extractCodec = (info:any): string | undefined => 
                    {
                        const match = info.mime.match(/codecs="([^"]+)"/);
                        return match ? match[1] : undefined;
                    };

                    const extractDimensions = (info:any):{width:number, height:number} | undefined =>
                    {
                        const videoTracks = info.videoTracks;
                        if (videoTracks === undefined) return undefined;

                        const track = videoTracks[0];
                        if (track === undefined) return undefined;

                        const width = track.track_width;
                        const height = track.track_height;

                        if (width === undefined || height === undefined) return undefined;

                        return {width, height};
                    }

                    const codec = extractCodec(info);
                    const dimensions = extractDimensions(info);
                    
                    if (codec === undefined || dimensions === undefined) 
                    {
                        callback(undefined);
                        return;
                    }

                    callback({width:dimensions.width, height:dimensions.height, codec});
                };

                mp4boxFile.onError = (e:any) => 
                {
                    breakEarly = true;

                    ConsoleUtil.warn('onError', e);

                    callback(undefined);
                };

                const reader = video.getReader();
                let fileStart = 0;

                while (true) 
                {
                    //@ts-ignore
                    if (breakEarly === true) 
                    {
                        reader.cancel();
                        break;
                    }
                    const {done, value} = await reader.read();
                    if (done) break;

                    const buffer = value.buffer;
                    (buffer as any).fileStart = fileStart;
                    fileStart += value.buffer.byteLength;

                    mp4boxFile.appendBuffer(buffer);
                }
        }
        
        return promise;
    }
    */

    /*
    #parseMP4Stream = async (readableStream:ReadableStream<Uint8Array>):Promise<MetaData> =>
    {
        async function parseBox(dataView: DataView, offset: number, boxStart: number = 0): Promise<{ width: number, height: number, codec: string }> 
        {
            let width = 0;
            let height = 0;
            let codec = '';
            
            for (let i = offset; i < dataView.byteLength;) 
            {
                const size = dataView.getUint32(i);
                const type = String.fromCharCode(...new Uint8Array(dataView.buffer, i + 4 + boxStart, 4));
            
                ConsoleUtil.log(`Reading box of size: ${size}, type: ${type}, offset: ${i + boxStart}`);
            
                if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
                ConsoleUtil.log(`Found container box: ${type}, parsing its children.`);
                const result = await parseBox(new DataView(dataView.buffer, i + 8 + boxStart, size - 8), 0, i + 8 + boxStart);
                width = result.width;
                height = result.height;
                codec = result.codec;
                } else if (type === 'tkhd') {
                //extract dimensions (width and height)
                //skipping initial bytes and extracting width and height
                width = dataView.getUint32(i + 80 + boxStart) / 65536;
                height = dataView.getUint32(i + 84 + boxStart) / 65536;
                } else if (type === 'stsd') {
                //extract codec
                //skipping initial bytes and reading codec type
                codec = String.fromCharCode(...new Uint8Array(dataView.buffer, i + 12 + boxStart, 4));

                
                } 
            
                i += size;
            }
        
            return { width, height, codec };
        }

        const reader = readableStream.getReader();
        let concatenatedBuffer = new Uint8Array();
      
        while (true) 
        {
            const { done, value } = await reader.read();
            if (done) break;
      
            const tempBuffer = new Uint8Array(concatenatedBuffer.length + value.length);
            tempBuffer.set(concatenatedBuffer, 0);
            tempBuffer.set(value, concatenatedBuffer.length);
            concatenatedBuffer = tempBuffer;
        }
      
        const dataView = new DataView(concatenatedBuffer.buffer);
        const result = await parseBox(dataView, 0);
      
        ConsoleUtil.log(`Width: ${result.width}, Height: ${result.height}, Codec: ${result.codec}`);

        return result;
    }
    */
}
