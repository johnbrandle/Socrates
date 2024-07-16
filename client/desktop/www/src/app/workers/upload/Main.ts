/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { CRYPTKey } from "../../../../../../../shared/src/library/utils/KeyUtil.ts";
import { Worker, type Task } from "../../../library/workers/Worker.ts";
import { UploadTask } from "./Shared.ts";
import { CryptUtil } from "../../../../../../../shared/src/library/utils/CryptUtil.ts";
import type { uint } from "../../../../../../../shared/src/library/utils/IntegerUtil.ts";
import type { IError } from "../../../../../../../shared/src/library/error/IError.ts";
import type { IBaseApp } from "../../../library/workers/IBaseApp.ts";
import { BaseApp } from "../../../library/workers/BaseApp.ts";
import { StreamUtil } from "../../../../../../../shared/src/library/utils/StreamUtil.ts";

const app = new (class extends BaseApp<IBaseApp<any>> 
{
    #_cryptUtil:CryptUtil<any> | undefined;
    public override get cryptUtil():CryptUtil<any> { return this.#_cryptUtil ??= new CryptUtil<any>(this); }

    #_streamUtil:StreamUtil<any> | undefined;
    public override get streamUtil():StreamUtil<any> { return this.#_streamUtil ??= new StreamUtil<any>(this); }
})() as BaseApp<IBaseApp<any>>;
type A = typeof app;

class Main extends Worker<A>
{    
    protected async execute(task:Task):Promise<any>
    {    
        try
        {
            switch (task.name)
            {
                case UploadTask.process:
                {
                    const key = task.args.key as CRYPTKey;
                    const partIndex = task.args.partIndex as number;
                    const chunkSize = task.args.chunkSize as number;

                    const stream = task.data as ReadableStream<Uint8Array>;
    
                    if (task.aborted === true) return;

                    const result = this._app.extractOrRethrow(await this.#process(stream, key, partIndex, chunkSize));
                    
                    if (task.aborted as boolean === true) return;

                    task.result = result;
                    task.transferableResults = [result[0]];
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

    async #process(stream:ReadableStream<Uint8Array>, key:CRYPTKey, partIndex:number, chunkSize:number):Promise<[ArrayBuffer, boolean, uint] | IError> 
    {   
        try
        {
            let [stream1, stream2] = stream.tee();

            const [countTransformer, bytesBeforeCompressionPromise] = this._app.streamUtil.createCountTransformer();
            stream1 = this._app.streamUtil.transform(stream1, [countTransformer]);

            stream1 = stream1.pipeThrough(new CompressionStream('gzip')); //compress the part
            
            let compressedBlob:Blob | undefined = await new Response(stream1).blob();
            
            const bytesBeforeCompression = this._app.extractOrRethrow(await bytesBeforeCompressionPromise);
            
            //if compressed size is larger, use the original part
            const streamToEncrypt = compressedBlob.size >= bytesBeforeCompression ? stream2 : compressedBlob.stream();
            const compressed = streamToEncrypt !== stream2;
            const bytes = compressed ? compressedBlob.size : bytesBeforeCompression;

            compressedBlob = undefined; //free up memory

            const [encryptTransformer, format] = this._app.cryptUtil.createVariableTransformer(key, partIndex);
            const encryptStream = this._app.streamUtil.transform(streamToEncrypt, [encryptTransformer], {chunkSize, allowVariableByteLengthTransformers:true});

            const encrypted = await new Response(encryptStream).arrayBuffer();

            return [encrypted, compressed, format];
        }
        catch(error) 
        {
            return this._app.warn(error, 'Failed to process part, {} {}', [partIndex, chunkSize], {errorOnly:true, names:[Main, this.#process]});
        }
    }
}

new Main(app);