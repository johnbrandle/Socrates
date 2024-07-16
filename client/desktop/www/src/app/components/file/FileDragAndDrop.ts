/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Component } from '../../../library/components/Component.ts';
import type { IApp } from '../../IApp.ts'
import { VirtualFolder } from '../../../../../../../shared/src/library/file/virtual/VirtualFolder.ts';
import { VirtualFile } from '../../../../../../../shared/src/library/file/virtual/VirtualFile.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import html from './FileDragAndDrop.html';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { EventListenerAssistant } from '../../../library/assistants/EventListenerAssistant.ts';
import type { IVirtualFolder } from '../../../../../../../shared/src/library/file/virtual/IVirtualFolder.ts';
import { IVirtualFileType, type IVirtualFile } from '../../../../../../../shared/src/library/file/virtual/IVirtualFile.ts';

class Elements 
{
    dropZone!:HTMLElement;
    
    headerArea!:HTMLElement;
    backButton!:HTMLButtonElement;

    bodyArea!:HTMLElement;

    footerArea!:HTMLElement;
}

@ComponentDecorator()
export class FileDragAndDrop<A extends IApp<A>> extends Component<A> 
{
    /*
    private _highlightedFolder:IVirtualFolder | null = null;
    */
 
    private _rootFolder:IVirtualFolder = new VirtualFolder(this._app, '');
    private _currentFolder:IVirtualFolder = this._rootFolder;

    private _busy:boolean = false;

    private _eventListenerAssistant!:EventListenerAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init(...args: any):Promise<void>
    { 
        const elements = this._elements;

        this.set(elements);

        const eventListenerAssistant = this._eventListenerAssistant = new EventListenerAssistant(this._app, this);

        if (elements.bodyArea) elements.bodyArea.html = elements.bodyArea.innerHTML;

        //drag and drop functionality

        eventListenerAssistant.subscribe(elements.dropZone, 'dragover', (event) => { event.preventDefault(); });
        eventListenerAssistant.subscribe(elements.dropZone, 'drop', (event:DragEvent) =>
        {
            event.preventDefault();
            const items = event.dataTransfer?.items;
            if (!items) return;

            this.addItems(items);
        });
        
        //folder highlight functionality
        /*
        let highLighted:HTMLElement;
        eventListenerAssistant.subscribe(this._bodyArea, 'dragenter', (event) => 
        {
            event.preventDefault();

            const target = event.target as HTMLElement;
            const folderElement = target.closest('.folder') as HTMLElement;
            if (!folderElement || folderElement == highLighted) return;
            
            if (highLighted)
            {
                this.highlightFolder(highLighted, false);
                highLighted = null;
            }

            highLighted = folderElement;
            this.highlightFolder(folderElement, true);
        });
        eventListenerAssistant.subscribe(this._bodyArea, 'dragleave', (e) =>
        {
            const isMouseOver = (element:HTMLElement, event:MouseEvent) =>
            {
                let rect = element.getBoundingClientRect(); //get the bounding rectangle of the element
              
                return (rect.left <= event.clientX && rect.right >= event.clientX && rect.top <= event.clientY && rect.bottom >= event.clientY); //check if the mouse coordinates are inside the bounding rectangle
            }

            e.preventDefault();

            const target = e.target as HTMLElement;
            const folderElement = target.closest('.folder') as HTMLElement;
            if (folderElement) 
            {
                if (!folderElement.classList.contains('highlighted')) return;
                if (isMouseOver(folderElement, e)) return;

                this.highlightFolder(folderElement, false);
                highLighted = null;
            }
            else if (highLighted)
            {
                this.highlightFolder(highLighted, false);
                highLighted = null;
            }
        });
        */

        //back button
        let backButton = elements.backButton;
        eventListenerAssistant.subscribe(backButton, 'click', async () =>
        {
            let parent = await this._currentFolder.getParent();
            if (!parent) return;
            
            this._currentFolder = parent;
            this.updateUI();
        });

        /* click to add files (we don't currently support this)
        eventListenerAssistant.subscribe(this._bodyArea, 'click', (e) =>
        {
            e.preventDefault();

            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;

            eventListenerAssistant.subscribe(input, 'change', () =>
            {
                const files = Array.from(input.files);
                this.addFiles(files);
            });

            input.click();
        });
        */

        return super.init();
    }

    private async addItems(items:DataTransferItemList):Promise<void> //called when files are drag and dropped
    {
        const readFile = (entry:FileSystemFileEntry):Promise<File> => new Promise<File>((resolve, reject) => entry.file((file:File) => resolve(file), (error:Error) => reject(error)));
        const readEntries = (reader:FileSystemDirectoryReader) => new Promise<FileSystemEntry[]>((resolve) => reader.readEntries((entries:FileSystemEntry[]) => resolve(entries)));

        const readDirectory = async (entry:FileSystemDirectoryEntry, virtualFolder:IVirtualFolder, update:Function) =>
        {
            const reader = entry.createReader();
            const entries = await readEntries(reader);
    
            for (const entry of entries) 
            {
                if (entry.isDirectory) 
                {
                    await this._app.promiseUtil.nextAnimationFrame(); //to prevent locking up the ui
                    update();
    
                    const subFolder = new VirtualFolder(this._app, entry.name);
                    virtualFolder.add(subFolder);
                    await readDirectory(entry as FileSystemDirectoryEntry, subFolder, update).catch(async (reason) => 
                    {
                        this.log(reason);
                        this.log(entry.name);
                        this.log(await subFolder.getPath());
                    });
                } 
                else 
                {
                    const file = await readFile(entry as FileSystemFileEntry).catch(async (reason) => 
                    {
                        this.log(reason);
                        this.log(entry.name);
                    });
    
                    if (!file) continue;
    
                    const virtualFile = new VirtualFile(this._app, file);

                    virtualFolder.add(virtualFile);
                    this.updateFooterUI();
                }
            }
        };

        /*
        if (this._highlightedFolder) this._currentFolder = this._highlightedFolder;
        this._highlightedFolder = null;
        */

        this.setBusy(true);

        const files: File[] = [];
        for (let i = 0; i < items.length; i++) 
        {
            const item = items[i];
            if (item.kind !== 'file') continue; 
            
            const entry = item.webkitGetAsEntry();
      
            if (!entry) continue;

            if (!entry.isDirectory) 
            {
                files.push(item.getAsFile()!);
                continue;
            }
            
            let folder = new VirtualFolder(this._app, entry.name);
            this._currentFolder.add(folder);
            await readDirectory(entry as FileSystemDirectoryEntry, folder, () => {}).catch(async (reason) => 
            {
                this.log(reason);
                this.log(entry.name);
                this.log(await folder.getPath());
            });
        }

        this.addFiles(files);
    };

    private addFiles(files: File[]):void
    {
        /*
        if (this._highlightedFolder) this._currentFolder = this._highlightedFolder;
        this._highlightedFolder = null;
        */

        files.forEach((file) => 
        {
            const virtualFile = new VirtualFile(this._app, file);
            this._currentFolder.add(virtualFile);

            this.updateFooterUI();
        });
        
        this.setBusy(false);
    };

    private setBusy(busy:boolean) //whether we are processing files (should block user from being able to add more files and UX input when true)
    {
        this._busy = busy;

        if (!busy)
        {
            this.updateUI();
            return;
        }

        const elements = this._elements;
        elements.bodyArea.innerHTML = elements.bodyArea.html;
        elements.bodyArea.firstElementChild!.innerHTML = 'Your files are being added. Please wait.';
        elements.backButton.style.visibility = 'hidden';

        (elements.bodyArea.children[1] as HTMLElement).innerText = '';
    }

    private async renderFile(virtualFile:IVirtualFile)
    {
        const fileElement = document.createElement('div');
        fileElement.classList.add('file');
        fileElement.title = await virtualFile.getPath();
        
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="bi bi-x"></i>';
        deleteButton.title = 'delete';
        deleteButton.classList.add('delete');
        deleteButton.style.visibility = 'hidden';

        deleteButton.onclick = (event) =>
        {
            event.stopImmediatePropagation();

            this.deleteFileOrFolder(virtualFile, fileElement);
        };
      
        fileElement.append(deleteButton);
      
        const icon = document.createElement('i');
        icon.className = await this.getFileIconClass(virtualFile);
        fileElement.append(icon);
      
        const name = document.createElement('span');
        name.innerText = await virtualFile.getName();
        fileElement.append(name);
      
        fileElement.onmouseenter = () =>
        {
            deleteButton.style.visibility = 'visible';
        }

        fileElement.onmouseleave = () =>
        {
            deleteButton.style.visibility = 'hidden';
        }

        this._elements.bodyArea.appendChild(fileElement);
    };
      
    private async renderFolder(virtualFolder:IVirtualFolder)
    {
        const folderElement = document.createElement('div');
        (folderElement as any).virtualFolder = virtualFolder;
        folderElement.classList.add('folder');
        folderElement.title = await virtualFolder.getPath();
      
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="bi bi-x delete"></i>';
        deleteButton.title = 'delete';
        deleteButton.classList.add('delete');
        deleteButton.style.visibility = 'hidden';
        
        deleteButton.onclick = (event) => 
        {
            event.stopImmediatePropagation();

            this.deleteFileOrFolder(virtualFolder, folderElement);
        };
      
        folderElement.append(deleteButton);
      
        const icon = document.createElement('i');
        icon.className = 'bi bi-folder-fill';
        folderElement.append(icon);
      
        const name = document.createElement('span');
        name.innerText = await virtualFolder.getName();
        folderElement.append(name);
      
        folderElement.onclick = () => 
        {
            this._currentFolder = virtualFolder;
            this.updateUI();
        };

        folderElement.onmouseenter = () =>
        {
            deleteButton.style.visibility = 'visible';
        }

        folderElement.onmouseleave = () =>
        {
            deleteButton.style.visibility = 'hidden';
        }

        this._elements.bodyArea.appendChild(folderElement);
    };

    private async deleteFileOrFolder(item:IVirtualFile | IVirtualFolder, element:HTMLElement):Promise<void>
    {
        const parent = await item.getParent();
        if (parent !== undefined) await parent.remove(item);
   
        element.remove();

        this.updateFooterUI();

        const children = [];
        for await (const child of this._currentFolder.getChildren(this)) children.push(child);
        if (!children.length) this.updateUI(); //they have deleted everything, show the This folder is empty... text
    };

    /*
    private highlightFolder(folderElement:HTMLElement, highlight:boolean) 
    {
        if (highlight) 
        {
            folderElement.classList.add('highlighted');
            this._highlightedFolder = (folderElement as any).virtualFolder;
        } 
        else folderElement.classList.remove('highlighted');
    }
    */

    private async updateUI() 
    {
        if (this._busy) return;

        const elements = this._elements;
        elements.bodyArea.innerHTML = '';
      
        if (await this._currentFolder.getParent()) elements.backButton.style.visibility = 'visible';
        else elements.backButton.style.visibility = 'hidden';

        const children = [];
        for await (const child of this._currentFolder.getChildren(this)) children.push(child);

        const app = this._app;

        children.forEach(async (child) => 
        {
            if (app.typeUtil.is<IVirtualFile>(child, IVirtualFileType) === true) this.renderFile(child);
            else this.renderFolder(child as IVirtualFolder);
        });

        if (!children.length)
        {
            elements.bodyArea.innerHTML = elements.bodyArea.html;
            if (this._currentFolder !== this._rootFolder) elements.bodyArea.firstElementChild!.innerHTML = 'This folder is empty. ' + elements.bodyArea.firstElementChild!.innerHTML;
        }

        await this.updateFooterUI();
    };

    private async updateFooterUI()
    {
        let [fileCount, folderCount] = await this._currentFolder.getCount(this);
        let bytes = this._app.textUtil.formatBytes(await this._currentFolder.getByteCount(this), -1);

        this._elements.footerArea.children[0].innerHTML = fileCount || folderCount ? `${fileCount} files, ${folderCount.toString()} folders, ${bytes}` : '&nbsp;';
        //this._elements.footerArea.children[1].innerHTML = encrypting && !this._busy ? `${encrypting} files waiting to be encrypted` : '&nbsp;';
    }

    private async getFileIconClass(virtualFile:IVirtualFile):Promise<string> 
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

    public get rootFolder()
    {
        return this._rootFolder;
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}