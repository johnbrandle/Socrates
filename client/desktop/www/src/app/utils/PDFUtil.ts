/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../../library/IBaseApp.ts';
import { ResolvePromise } from '../../../../../../shared/src/library/promise/ResolvePromise.ts';

type PageDimensions = 
{
    width:number, 
    height:number
};

type PDFJSLib = 
{
    GlobalWorkerOptions:{workerSrc:string}, 
    getDocument:(data:any) => {promise:Promise<PDF>}
};

type Page = 
{
    getViewport:(options:{scale:number}) => {width:number, height:number}, 
    render:(options:{canvasContext:CanvasRenderingContext2D, transform?:number[], viewport:{width:number, height:number}}) => {promise:Promise<void>};
};

export type PDF = 
{
    numPages:number, 
    getPage:(pageNumber:number) => Promise<Page>
};

@SealedDecorator()
export class PDFUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    private static _pdfjsLib:Promise<PDFJSLib> | undefined;

    private static loadLibrary(app:IBaseApp<any>):Promise<PDFJSLib>
    {       
        if (this._pdfjsLib) return this._pdfjsLib;

        const promise = new ResolvePromise<PDFJSLib>();
        this._pdfjsLib = promise;
        
        const config = app.configUtil.get(true).classes.PDFUtil;

        const script = document.createElement('script');
        script.setAttribute('type', 'module');
        script.setAttribute('src', config.src);
        script.onload = async () =>
        {
            const pdfjsLib = (window as any).pdfjsLib as PDFJSLib;

            pdfjsLib.GlobalWorkerOptions.workerSrc = config.workerSrc;

            promise.resolve(pdfjsLib);
        }
        
        document.head.appendChild(script);

        return promise;
    }

    public async load(data:Uint8Array):Promise<PDF>
    {
        const pdfjsLib = await PDFUtil.loadLibrary(this._app);

        const loadingTask = pdfjsLib.getDocument({data, isEvalSupported:false});
        const pdf = await loadingTask.promise;

        return pdf;
    }

    public async drawPageToCanvas(pdf:PDF, page:number | Page, options?:{canvas?:HTMLCanvasElement, scale?:number}):Promise<HTMLCanvasElement>
    {
        const scale = options?.scale ?? 1.5;

        page = this._app.typeUtil.isNumber(page) ? await pdf.getPage(page) : page;
        const viewport = page.getViewport({scale});
        const outputScale = window.devicePixelRatio || 1;

        const canvas = options?.canvas ?? document.createElement('canvas');
        const context = canvas.getContext('2d') ?? undefined;
        if (context === undefined) this._app.throw('Could not get canvas context', []);

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        await page.render({canvasContext:context, transform, viewport}).promise;

        return canvas;
    }

    public async getPageDimensions(pdf:PDF, page:number | Page, options?:{scale?:number}):Promise<PageDimensions>
    {
        const scale = options?.scale ?? 1.5;

        page = this._app.typeUtil.isNumber(page) ? await pdf.getPage(page) : page;

        const viewport = page.getViewport({scale});

        return {width:viewport.width, height:viewport.height};
    }
}   


/*
    public static async getMetadata(blob:Blob):Promise<MetaData | undefined | IAborted | IError>;
    public static async getMetadata(uint8Array:Uint8Array, contentType:string):Promise<MetaData | undefined | IAborted | IError>;
    public static async getMetadata(stream:ReadableStream<Uint8Array>, contentType:string):Promise<MetaData | undefined | IAborted | IError>;
    public static async getMetadata(stream:ReadableStream<Uint8Array> | Uint8Array | Blob, contentType?:string)
    {
        return undefined;
    }

    public static async getThumbnail(streamable:IDatable<ReadableStream<Uint8Array>>, mimeType:string, maxWidth:number, maxHeight:number, abortable:IAbortable):Promise<Blob | undefined | IAborted | IError>
    {
        let workerController:ImageThumbnailWorkerController<any> | undefined;

        try
        {
            const _ = new AbortableHelper(abortable).throwIfAborted();

            workerController = new ImageThumbnailWorkerController(ImageUtil._app, ImageUtil._app, abortable);

            const uint8Array = _.value(await workerController.generateThumbnail(streamable, maxWidth, maxHeight, mimeType));
            if (uint8Array === undefined) return undefined;

            return new Blob([uint8Array], {type:mimeType});
        }
        catch (error)
        {
            return Error.warn(error, [ImageUtil, ImageUtil.getThumbnail], 'Error generating thumbnail', arguments);
        }
        finally
        {
            workerController?.dnit();
        }
    }

    public static async getBitmap(streamable:IDatable<ReadableStream<Uint8Array>>, mimeType:string, abortable:IAbortable, maxWidth?:number, maxHeight?:number):Promise<ImageBitmap | undefined | IAborted | IError>
    {
        let workerController:ImageBitmapWorkerController<any> | undefined;

        try
        {
            const _ = new AbortableHelper(abortable).throwIfAborted();

            workerController = new ImageBitmapWorkerController(ImageUtil._app, ImageUtil._app, abortable);

            return _.value(await workerController.generateBitmap(streamable, mimeType, maxWidth, maxHeight));
        }
        catch (error)
        {
            return Error.warn(error, [ImageUtil, ImageUtil.getBitmap], 'Error generating bitmap', arguments);
        }
        finally
        {
            workerController?.dnit();
        }
    }
    */
