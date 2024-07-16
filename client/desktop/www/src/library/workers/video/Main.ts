/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Worker, type Task } from "../Worker.ts"
import { VideoThumbnailTask, VideoInfoTask, type Info, VideoTranscodeTask } from "./Shared.ts";
import { BaseApp } from "../BaseApp.ts";
import type { FFmpeg } from './../../../../js/thirdparty/ffmpeg_wasm/ffmpeg/package/dist/esm/index.js';
import { PromiseUtil } from "../../../../../../../shared/src/library/utils/PromiseUtil.ts";
import type { IBaseApp } from "../IBaseApp.ts";
import { StreamUtil } from "../../utils/StreamUtil.ts";

const importScripts = self.importScripts;
const log = self.console.log;

const secondsToHMS = (seconds:number):string =>
{
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(remainingSeconds).padStart(2, '0');
    
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
}

const _app = new (class extends BaseApp<IBaseApp<any>> 
{
    #_streamUtil:StreamUtil<any> | undefined;
    public override get streamUtil():StreamUtil<any> { return this.#_streamUtil ??= new StreamUtil<any>(this); }

    #_promiseUtil:PromiseUtil<any> | undefined;
    get promiseUtil():PromiseUtil<any> { return this.#_promiseUtil ??= new PromiseUtil<any>(this); }
})() as IBaseApp<any>;
type A = typeof _app;

class Main extends Worker<A>
{
    protected async execute(task:Task):Promise<any>
    {    
        try
        {
            switch (task.name)
            {
                case VideoThumbnailTask.generateThumbnail:
                {
                    const ffmpeg = await this.#getNewFFmpeg();
                    if (ffmpeg === undefined || task.aborted === true) break;
                    
                    const stream = task.data as ReadableStream<Uint8Array>;
                    const uint8Array = await this.#generateThumbnail(ffmpeg, stream);
                    const arrayBuffer = uint8Array !== undefined ? uint8Array.buffer : undefined;
                    task.result = arrayBuffer;
                    task.transferableResults = arrayBuffer !== undefined ? [arrayBuffer] : [];
                    break;
                }
                case VideoTranscodeTask.transcode:
                {
                    const ffmpeg = await this.#getNewFFmpeg();
                    if (ffmpeg === undefined || task.aborted === true) break;
                    
                    const stream = task.data as ReadableStream<Uint8Array>;
                    const uint8Array = await this.#transcode(ffmpeg, stream);
                    const arrayBuffer = uint8Array !== undefined ? uint8Array.buffer : undefined;
                    task.result = arrayBuffer;
                    task.transferableResults = arrayBuffer !== undefined ? [arrayBuffer] : [];
                    break;
                }
                case VideoInfoTask.getInfo:
                {
                    const stream = task.data as ReadableStream<Uint8Array>;
                    const info = await this.#getInfo(stream);
                    task.result = info;
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

    private _loaded = false;
    #getNewFFmpeg = async ():Promise<FFmpeg | undefined> => //must get a new one every time, otherwise memory accumulates and is never released until we call terminate()
    {
        try
        {
            const currentQueueItem = this.currentTask;

            if (this._loaded === false)
            {
                //hack to be able to run ffmpeg in a worker
                const basePath = self.location.href.substring(0, self.location.href.lastIndexOf("/") + 1);
                (self as any).document = {currentScript:{src:basePath + '/thirdparty/ffmpeg_wasm/ffmpeg/package/dist/umd/ffmpeg.js'}};
                (self as any).importScripts = undefined;

                importScripts('./../../../../js/thirdparty/ffmpeg_wasm/ffmpeg/package/dist/umd/ffmpeg.js');
                
                this._loaded = true;
            }
            const FFmpegClass = (self as any).FFmpegWASM.FFmpeg as typeof FFmpeg;

            const [promise, callback] = _app.promiseUtil.promise<FFmpeg | undefined>();
            const create = async ():Promise<FFmpeg | undefined> =>
            {
                let finished = false;
                let success = false;
                const ffmpeg = new FFmpegClass();

                ffmpeg.load({coreURL: "./../../../../core/package/dist/umd/ffmpeg-core.js"}).then((...args:any) => 
                {              
                    success = finished = true;
                    
                    callback(ffmpeg);
                }).catch((...args:any) =>
                {
                    finished = true;

                    console.warn('failed to load ffmpeg. trying again...');
                });

                let time = 10000;
                while (time > 0)
                {
                    if (finished) break;

                    await _app.promiseUtil.wait(100);
                    time -= 100;
                }
                
                if (currentQueueItem.aborted === true) //ffmpeg will throw an error if we try to terminate it while it's loading, so wait for it to finish loading even if we are cancelled
                {
                    callback(undefined);
                    return promise;
                }

                if (!success) self.setTimeout(create, 1000);
                
                return promise;
            };

            return create();
        }
        catch(error) 
        {
            console.warn(error);
        }

        return undefined;
    }

    #generateThumbnail = async (ffmpeg:FFmpeg, stream:ReadableStream<Uint8Array>):Promise<Uint8Array | undefined> => 
    {
        const currentQueueItem = this.currentTask;
        const uint8Array = await this._app.streamUtil.toUint8Array(stream, {maxLength:5242880 * 20}); //100MB max

        if (currentQueueItem.aborted === true) return undefined;

        const args = 
        [
            "-ss", secondsToHMS(8),
            "-q:v", "4",           //lower quality to speed up the process
            "-preset", "ultrafast", //use a faster encoding preset
            "-frames:v", "1",      //only process 1 frame
            "-update", "1",
        ]

        return this.#executeFFMPEG(ffmpeg, uint8Array, args);
    }

    #transcode = async (ffmpeg:FFmpeg, stream:ReadableStream<Uint8Array>):Promise<Uint8Array | undefined> => 
    {
        const currentQueueItem = this.currentTask;
        const uint8Array = await this._app.streamUtil.toUint8Array(stream);

        if (currentQueueItem.aborted === true) return undefined;

        const args = 
        [
            "-q:v", "4",           //lower quality to speed up the process
            "-preset", "ultrafast", //use a faster encoding preset
            "-update", "1"
        ]

        return this.#executeFFMPEG(ffmpeg, uint8Array, args);
    }

    #executeFFMPEG = async (ffmpeg:FFmpeg, uint8Array:Uint8Array, args:Array<string>):Promise<Uint8Array | undefined> =>
    {
        const currentQueueItem = this.currentTask;
        const onLog = (data:{message:string}) =>
        {
            //ConsoleUtil.log('log: ' + data.message);
        };

        const onProgress = (data:{progress:number}) =>
        {
            //ConsoleUtil.log('progress: ' + data.progress);
        }

        ffmpeg.on("log", onLog);
        ffmpeg.on("progress", onProgress);

        const idFrom = 'from';
        const idTo = `${idFrom}.mp4`;

        let cleanedUp = false;
        const cleanup = ():undefined =>
        {
            if (cleanedUp === true) return undefined;
            cleanedUp = true;

            ffmpeg.off("log", onLog);
            ffmpeg.off("progress", onProgress);

            ffmpeg.deleteFile(idFrom);
            ffmpeg.deleteFile(idTo);
        }

        let data:Uint8Array | undefined;
        try
        {
            if (currentQueueItem.aborted === true) return;

            await ffmpeg.writeFile(idFrom, uint8Array);

            if (currentQueueItem.aborted as boolean === true) return;

            args.unshift("-i", idFrom);
            args.push(idTo);

            let isResolved = false;
            let isRejected = false;
            ffmpeg.exec(args).then(() => isResolved = true).catch(() => isRejected = true);
            
            while (true)
            {
                if (isResolved as boolean === true) break;

                if (isRejected as boolean === true) return;

                if (currentQueueItem.aborted as boolean === true) return;

                await _app.promiseUtil.wait(250);
            }

            if (currentQueueItem.aborted as boolean === true) return;

            data = await ffmpeg.readFile(idTo) as Uint8Array;

            if (currentQueueItem.aborted as boolean === true) return;

        }
        catch(e) 
        {
            console.warn(e, uint8Array);
        }
        finally
        {
            cleanup();
        }

        return data;
    }
    
    #getInfo = async (stream:ReadableStream<Uint8Array>):Promise<Info | undefined> => 
    {
        const currentQueueItem = this.currentTask;
        let data:Info | undefined;

        try
        {
            Object.defineProperty(self, 'location', 
            {
                value: new URL('http://localhost:800/js/thirdparty/ffprobe_wasm/'), //set to whatever the script expects
                writable: false, //the property must be read-only to mimic the original
            });

            self.console.log = (...args:any) => {}; //prevent ffprobe from logging to console
            self.importScripts('./thirdparty/ffprobe_wasm/ffprobe-wasm.js'); //load ffprobe into worker context.

            let mounted = false;
            const cleanup = ():undefined =>
            {
                //@ts-ignore
                if (mounted === true) FS.unmount('/work');
    
                //@ts-ignore
                let pthread = Module["PThread"];
    
                pthread.terminateAllThreads();
            }

            try
            {
                const [promise, onInitialized] = _app.promiseUtil.promise();
            
                //@ts-ignore
                Module["onRuntimeInitialized"] = onInitialized;
                await promise;
    
                if (currentQueueItem.aborted === true) return;
    
                //@ts-ignore
                if (!FS.analyzePath('/work').exists) FS.mkdir('/work');
    
                const uint8Array = await this._app.streamUtil.toUint8Array(stream, {maxLength:5 * 1024 * 1024}); //5MB only
    
                if (currentQueueItem.aborted as boolean === true) return;
    
                const file = new File([uint8Array], 'video');
    
                //@ts-ignore
                FS.mount(WORKERFS, { files: [file] }, '/work');
                mounted = true;
    
                //@ts-ignore Call the wasm module.
                const info = Module.get_file_info('/work/' + file.name);
    
                //remap streams into collection.
                const s = [];
                for (let i = 0; i < info.streams.size(); i++) 
                {
                    const tags:any = {};
                    for (let j = 0; j < info.streams.get(i).tags.size(); j++) 
                    {
                        const t = info.streams.get(i).tags.get(j);
                         
                        tags[t.key] = t.value;
                    }
                    s.push({...info.streams.get(i), ...{ tags}});
                }
    
                //remap chapters into collection.
                const c = [];
                for (let i = 0; i < info.chapters.size(); i++) 
                {
                    const tags:any = {};
                    for (let j = 0; j < info.chapters.get(i).tags.size(); j++) 
                    {
                        const t = info.chapters.get(i).tags.get(j);
                        tags[t.key] = t.value;
                    }
                    c.push({...info.chapters.get(i), ...{tags}});
                }
    
                const versions = 
                {
                    //@ts-ignore
                    libavutil:  Module.avutil_version(),
                    //@ts-ignore
                    libavcodec:  Module.avcodec_version(),
                    //@ts-ignore
                    libavformat:  Module.avformat_version(),
                };
    
                data = {...info, streams: s, chapters: c, versions}
            }
            catch(error) 
            {
                console.warn(error);
            }
            finally
            {
                cleanup();
            }
        }
        catch(error) 
        {
            console.warn(error);
        }

        return data;
    }
}

new Main(_app);