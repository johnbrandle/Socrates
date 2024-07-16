/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../../../../../../shared/src/library/decorators/SealedDecorator";
import type { VirtualFile } from "../../../../../../shared/src/library/file/virtual/VirtualFile";
import type { VirtualFolder } from "../../../../../../shared/src/library/file/virtual/VirtualFolder";
import type { IBaseApp } from "../../library/IBaseApp";

@SealedDecorator()
export class FileSystemUtil<A extends IBaseApp<A>>
{    
    private _app:A;

    private _standardIconTemplate!:HTMLTemplateElement;

    public constructor(app:A)
    {
        this._app = app;

        const standardIconTemplate = document.createElement('template');
        standardIconTemplate.innerHTML = `
        <div name="icon" class="tile-grid" draggable="false">
            <div name="content" class="tile-grid-content">
                <span name="thumb" class="thumb">
                    <div class="icon-bg-pulse"></div>
                </span>
                <span name="name" contenteditable="false" class="name"></span>
            </div>
        </div>`;
        this._standardIconTemplate = standardIconTemplate;
    }

    public getStandardIconHTML():HTMLElement
    {
        return (this._app.domUtil.clone(this._standardIconTemplate.content)).firstElementChild as HTMLElement;
    }

    public async getFolderIconClass<T extends VirtualFolder<A>>(virtualFolder:T):Promise<string>
    {
        //icon.className = 'bi bi-folder-fill';

        return '';
    }

    public async getFileIconClass<T extends VirtualFile<A>>(virtualFile:T):Promise<string> 
    {
        const getIconString = (fileType:string) =>
        {
            switch(fileType)
            {
                case 'csv':
                case 'dat':
                case 'xls':
                case 'xlsx':
                case 'ods':
                case 'sxc':
                case 'application/vnd.ms-excel':
                    return 'bi bi-file-earmark-bar-graph';
                case 'pptx':
                case 'ppt':
                    return 'bi bi-file-earmark-slides';
                case 'doc':
                case 'docx':
                    return 'bi bi-file-earmark-word';
                case 'ttf':
                    return 'bi bi-file-earmark-font';
                case 'exe':
                case 'bin':
                    return 'bi bi-file-earmark-binary'
                case 'text/javascript':
                case 'js':
                case 'ts':
                case 'as':
                case 'c':
                case 'h':
                case 'css':
                case 'bat':
                case 'sql':
                case 'php':
                    return 'bi bi-file-earmark-code';
                case '7z':
                case 'rar':
                case 'application/x-7z-compressed':
                case 'application/zip':
                case 'application/x-zip-compressed':
                case 'application/x-tar':
                case 'application/vnd.rar':
                case 'application/gzip':
                case 'application/x-bzip2':
                case 'application/x-bzip':
                case 'application/x-freearc':
                    return 'bi bi-file-earmark-zip';
                case 'application/pdf':
                    return 'bi bi-file-earmark-text';
            }
    
            if (fileType.startsWith('image/')) return 'bi bi-file-earmark-image'; 
            if (fileType.startsWith('video/')) return 'bi bi-file-earmark-play'; 
            if (fileType.startsWith('audio/')) return 'bi bi-file-earmark-music'; 
            if (fileType.startsWith('text/')) return 'bi bi-file-earmark-text';

            return '';
        };

        let string;
        
        let type = await virtualFile.getMimeType();
        if (type) string = getIconString(type); //try mime type first
        if (string) return string;

        let parts = (await virtualFile.getName()).split('.');
        let extension = parts.length > 1 ? parts.pop() : '';
        if (extension) string = getIconString(extension);
        if (string) return string;

        return 'bi bi-file-earmark';
    };

}