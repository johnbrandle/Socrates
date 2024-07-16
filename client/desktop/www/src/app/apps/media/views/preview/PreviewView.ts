/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { View } from "../../../../../library/components/view/View";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IApp } from "../../../../IApp";
import html from './PreviewView.html';
import { DebounceAssistant } from "../../../../../library/assistants/DebounceAssistant";
import { SignalAssistant } from "../../../../../library/assistants/SignalAssistant";
import { Signal } from "../../../../../../../../../shared/src/library/signal/Signal";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import { type filepath, type folderpath } from "../../../../../../../../../shared/src/library/file/Path";
import type { IAbortable } from "../../../../../../../../../shared/src/library/abort/IAbortable";
import type { IAborted } from "../../../../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../../../../shared/src/library/error/IError";
import { AbortController } from "../../../../../../../../../shared/src/library/abort/AbortController";
import type { ISystemDrive } from "../../../../../library/file/drive/ISystemDrive";

class Elements
{   
    preview!:HTMLElement;
}

@ComponentDecorator()
export class PreviewView<A extends IApp<A>> extends View<A>
{
    private _signalAssistant!:SignalAssistant<A>;

    private _drive!:ISystemDrive<A>;

    public readonly onCurrentFolderChangedSignal = new Signal<[View<A>, folderpath]>(this);

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init():Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._signalAssistant = new SignalAssistant(this._app, this);

        this._drive = this._app.userManager.systemDrive;

        return super.init();
    }

    public preview = new DebounceAssistant(this, async (abortable:IAbortable, filePath:filepath):Promise<void | IAborted | IError> =>
    {
        try
        {
            const _ = this.createAbortableHelper(abortable).throwIfAborted();

            const abortController = new AbortController(this._app, [this, abortable]);

            if (this.initialized !== true) this._app.throw('preview called before initialized', [], {correctable:true});

            const storageFileSystem = this._drive;

            const canvas = document.createElement('canvas');
    
            const storageFile = storageFileSystem.getFile(filePath);

            const mimeType = _.value(await storageFile.getMimeType());
            if (this._app.stringUtil.isEmpty(mimeType) === true) this._app.throw('mimeType is empty', []);

            const elements = this._elements;
            elements.preview.firstElementChild?.remove(); 

            let imageBitmap:ImageBitmap | undefined;

            const isImage = this._app.fileUtil.isImage(mimeType);
            const isVideo = this._app.fileUtil.isVideo(mimeType);
            if (isImage === true || isVideo === true)
            {
                imageBitmap = _.value(await storageFile.getScreenshot(abortController));
                if (imageBitmap === undefined) return;
            }

            if (isImage === true)
            {
                const context = canvas.getContext('2d') ?? undefined;
                if (context === undefined) return;

                canvas.width = imageBitmap!.width;
                canvas.height = imageBitmap!.height;
                context.drawImage(imageBitmap!, 0, 0);
        
                elements.preview.appendChild(canvas);
                return;
            }

            if (isVideo === true)
            {
                const video = document.createElement('video');
                elements.preview.appendChild(video);
                video.style.width = '100%';
                video.style.height = '100%';
                video.autoplay = true;
                video.controls = true;
                video.muted = true;
                video.loop = true;

                const data = _.value(await storageFile.getTranscodedBytes(abortController)) ?? _.value(await storageFile.getBytes(abortController));
                const stream = _.value(await data.get());
                const uint8Array = _.value(await this._app.streamUtil.toUint8Array(stream));

                let mimeCodec = 'video/mp4; codecs="avc1.640028"';
                if (MediaSource.isTypeSupported(mimeCodec) === false) console.log('not supported');//mimeCodec = 'video/mp4; codecs="avc1.640028, mp4a.40.2"';
                const mediaSource = new MediaSource();
                let sourceBuffer:SourceBuffer | undefined;

                mediaSource.addEventListener('sourceopen', () => 
                {
                    sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
                    console.log('sourceopen', sourceBuffer.updating);  // Check if buffer is already updating

                    sourceBuffer.addEventListener('updateend', () => 
                    {
                        console.log('updateend called', mediaSource.readyState);

                        if (mediaSource.readyState === 'open') 
                        {
                            console.log('called2');
                            mediaSource.endOfStream();
                            video.play();
                        }
                    }, {once:true});

                    sourceBuffer.addEventListener('error', event => {
                        console.error('Source buffer error:', event);
                    });

                    sourceBuffer.addEventListener('abort', event => {
                        console.error('Source buffer abort event:', event);
                    });

                    if (!sourceBuffer.updating) {
                        console.log(uint8Array.length);
                        sourceBuffer.appendBuffer(uint8Array);
                        console.log('Buffer appended');
                    } else {
                        console.log('Buffer was updating, wait to append');
                    }
                });
                const blob = new Blob([uint8Array], {type:'video/mp4'});

                video.src = URL.createObjectURL(blob); //URL.createObjectURL(mediaSource);
                
                
                /*
                let reader = new FileReader();
                reader.onload = function(event) {
                    chunks[chunks.length] = new Uint8Array(event.target.result);
                    pump();
                };
                reader.readAsArrayBuffer(blob);
                */
                /*
                const video = document.createElement('video');
                
                const data = _.value(await storageFile.getTranscodedBytes(abortController)) ?? _.value(await storageFile.getBytes(abortController));
                const stream = _.value(await data.get());

                const mediaStream = await navigator.mediaDevices.getUserMedia({video:true});
                mediaStream.

                //video.srcObject = VideoUtil.createObjectURL(imageBitmap!);


                elements.preview.appendChild(video);
                return;
                */
            }

            this.onResize();
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to set current folder', [], {names:[this.constructor, 'preview']});
        }
    }, {throttle:true, delay:true, id:'preview'});

    protected override async onResize(_initial?:boolean, _entry?:ResizeObserverEntry):Promise<void> 
    {
        const elements = this._elements;

        if ((elements.preview.firstElementChild ?? undefined) === undefined) return;

        const canvas = elements.preview.firstElementChild as HTMLCanvasElement;

        const width = this._element.offsetWidth;
        const height = this._element.offsetHeight;
      
        //get the aspect ratio of the canvas
        const canvasRatio = (parseInt(canvas.style.width, 10) || 1) / (parseInt(canvas.style.height, 10) || 1);
        
        //calculate the maximum possible widths and heights while maintaining the aspect ratio
        const scaleWidth = height * canvasRatio;
        const scaleHeight = width / canvasRatio;
        
        //determine if scaling by width causes the height to exceed the container's height
        if (scaleHeight <= height) 
        {
            //scale by width (the full width fits within the container)
            canvas.style.width = width + 'px';
            canvas.style.height = scaleHeight + 'px';
        } 
        else 
        {
            //scale by height (scaling by width would make the height too tall)
            canvas.style.width = scaleWidth + 'px';
            canvas.style.height = height + 'px';
        }
    }

    public override get transparent():boolean { return false; } //need to override this again, since view sets this to true

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}