/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Tile } from "./Tile";
import type { IStorageTileData } from "./IStorageTileData";
import type { IStorageTile } from "./IStorageTile";
import { ComponentDecorator } from "../../decorators/ComponentDecorator";
import type { ITileable } from "./ITileable";
import type { IBaseApp } from "../../IBaseApp";
import { IStorageTileType } from "./IStorageTile";
import { IContextableType, type IContextable } from "../IContextable";
import type { IContextMenuData } from "../../managers/IContextMenuManager";
import type { IDatable } from "../../../../../../../shared/src/library/data/IDatable";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { AbortController } from "../../../../../../../shared/src/library/abort/AbortController";
import type { IDrive } from "../../../../../../../shared/src/library/file/drive/IDrive";
import { ISystemDriveType, type ISystemDrive } from "../../file/drive/ISystemDrive";
import type { IFileInfo, IFolderInfo } from "../../../../../../../shared/src/library/file/storage/IFileStorage";
import { ImplementsDecorator } from "../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import type { emptystring } from "../../../../../../../shared/src/library/utils/StringUtil";
import type { path } from '../../../../../../../shared/src/library/file/Path';
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../../shared/src/library/error/IError";
import type { AbortableHelper } from "../../../../../../../shared/src/library/helpers/AbortableHelper";
import { Aborted } from "../../../../../../../shared/src/library/abort/Aborted";

export class StorageTileElements 
{
    content!:HTMLElement;
    thumb!:HTMLElement;
    name!:HTMLElement;
}

@ImplementsDecorator(IStorageTileType, IContextableType)
@ComponentDecorator()
export abstract class StorageTile<A extends IBaseApp<A>, D extends IStorageTileData> extends Tile<A, D> implements IStorageTile<A, D>, IContextable
{
    private _drive!:IDrive<A>;

    protected _iconer!:Iconer<A>;

    private _visible = false;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, tileable:ITileable<A, D, any>, drive:IDrive<A>)
    {
        super(app, destructor, element, tileable);

        this._drive = drive;

        this.cnit();
    }

    protected cnit()
    {
        this._element.style.position = 'absolute';
        this._element.style.left = '0px';
        this._element.style.top = '0px';
        this._element.style.transformOrigin = '0 0';
        this._element.style.willChange = 'top, left, transform';
    }

    public override async init(html:string):Promise<void> 
	{
        this.element.innerHTML = html;

        const elements = this._elements;
         
        this.set(elements);

        this._iconer = new Iconer(this._app, this, this.abortableHelper, elements, () => { this.sizeElements(this._height); });

        return super.init();
    }

    public override onClicked(event:MouseEvent):boolean
    {
        return super.onClicked(event);
    }

    public override get selected():boolean
    {
        return super.selected; 
    }

    public override set selected(val:boolean)
    {
        if (val && this._data?.info === undefined) this._app.throw('Cannot select a tile with no data', [], {correctable:true});
        else if (this._data?.info !== undefined) super.selected = val;
        
        if (val) this._element.style.backgroundColor = '#cccccc33';
        else this._element.style.backgroundColor = 'unset';
    }

    protected override onDoubleClicked(event:MouseEvent):boolean
    {
        if ((event.target as HTMLElement)?.parentElement?.getAttribute('name') !== 'thumb') return false;

        return super.onDoubleClicked(event);
    }

    protected override onDragStart(event:DragEvent):boolean
    {
        event.dataTransfer!.effectAllowed = 'move';

        return super.onDragStart(event);
    }

    protected override onDrag(event:DragEvent):boolean
    {
        return super.onDrag(event);
    }

    protected override onDragEnd(event:DragEvent):boolean
    {
        return super.onDragEnd(event);
    }

    /** methods for the drag target icon */

    protected override onDragEnter(event:DragEvent):boolean
    {
        if (this._data?.info?.type === 'file') return false;
        const result = super.onDragEnter(event);
        if (!result) return result;

        //if (this._contents && this._contents.fileOrFolderData.type === 'file') 
        //{
        //event.preventDefault();
        //return false;
        //}

        if (!this.selected) this._element.style.backgroundColor = '#cccccc33';

        return true;
    }

    protected override onDragOver(event:DragEvent):boolean
    {
        //if (this._data.storageData?.type === 'file') return false;
        //if (!this._app.tileDragAndDropManager.dragging || (this._contents && this._contents.fileOrFolderData.type === 'file')) 
       //{
       //event.preventDefault();
       //return false;
       //}

        return super.onDragOver(event);
    }

    protected override onDragLeave(event:DragEvent):boolean
    {
        if (this._data?.info === undefined) return false;

        if (this._data.info.type === 'file') return false;

        const result = super.onDragLeave(event);
        if (!result) return result;

       //if (!this._app.tileDragAndDropManager.dragging || (this._contents && this._contents.fileOrFolderData.type === 'file')) 
       //{
       //event.preventDefault();
      //return false;
       //}

       if (!this.selected) this._element.style.backgroundColor = 'unset'; 

        return true;
    }

    protected override onDrop(event:DragEvent):boolean
    {
        //event.preventDefault();

       //if (!this._app.tileDragAndDropManager.dragging || (this._contents && this._contents.fileOrFolderData.type === 'file')) return false;

       if (!this.selected) this._element.style.backgroundColor = 'unset';

        return super.onDrop(event);
    }

    public showOutline()
    {
        this._element.style.outline = '1px solid #00000033';
    }

    public onContextMenu(event:MouseEvent):IContextMenuData | undefined
    {
        if (this._data?.info === undefined) return undefined;

        if (!this._elements.thumb.contains(event.target as Node)) return undefined;

        let contextMenuData:IContextMenuData = {items:[]};
        let items = contextMenuData.items;

        if (this._data.info!.type === 'folder') 
        {
            items.push({label: 'Open'});
            items.push({label: "Open in Terminal"}),
            items.push({label: 'Download'}),
            items.push({});
            items.push({label: 'Rename'});
            items.push({label: 'Copy'});
            items.push({label: 'Delete'});
            items.push({});
            items.push({label: 'Hide from Desktop'});
            items.push({label: 'Properties...'});
            
        }
        else
        {
            items.push({label: 'Open'});
            items.push({label: 'Open in', items: [{label: 'Files & Folders'}, {}, {label: 'Notes++'}]});
            items.push({label: 'Download'}),
            items.push({});
            items.push({label: 'Rename'});
            items.push({label: 'Copy'});
            items.push({label: 'Delete'});
            items.push({});
            items.push({label: 'Hide from Desktop'});
            items.push({label: 'Properties...'});
        }
        
        return contextMenuData;
    }

    public async renew(data:D | undefined):Promise<void | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            _.check(await super.renew(data));

            const elements = this._elements;

            if (data === undefined || data.info === undefined) 
            {
                this.id = '';
                _.check(await this._iconer.renew(undefined, false));
                elements.name.innerText = '';
                elements.thumb.innerHTML = '';

                this._element.style.backgroundColor = 'unset';

                this._element.draggable = false;

                this._app.contextMenuManager.remove(this);

                elements.name.contentEditable = 'false';
                this._eventListenerAssistant.unsubscribe(elements.name);

                return;
            }

            const storageData = data.info;

            this.id = storageData.path;
            elements.name.innerText = storageData.name;
            elements.name.title = storageData.name;

            if (data.selected) this._element.style.backgroundColor = '#cccccc33';
            else this._element.style.backgroundColor = 'unset';

            this._app.contextMenuManager.add(this);

            this._element.draggable = true;

            this._eventListenerAssistant.unsubscribe(elements.name, 'dblclick');
            if (storageData.metadata.immutable === false) this._eventListenerAssistant.subscribe(elements.name, 'dblclick', this.#onEditBegin);

            this._iconer.renew(storageData, this._visible); //don't wait for this to finish
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to renew storage tile', arguments, {names:[this.constructor, this.renew]});
        }
    }

    protected override async onVisible(visible:boolean):Promise<void>
    {
        this._visible = visible;

        if (this._data?.info === undefined) return;

        await this._iconer.renew(this._data?.info, visible);
    }

    public override setSize(width:number, height:number):void 
    {
        super.setSize(width, height);

        this.sizeElements(height);
    }

    protected getNameHeight():number { return this._elements.name.offsetHeight };
    
    protected sizeElements(height:number):void
    {
        if (height === 0) return;

        const nameHeight = this.getNameHeight();

        if (nameHeight === 0) return;

        const elements = this._elements;
        const maxHeight = height - nameHeight;
        const thumbElement = elements.thumb;
        
        thumbElement.style.width = maxHeight + 'px';
        thumbElement.style.height = maxHeight + 'px';
        thumbElement.style.fontSize = (maxHeight / 2) + 'px';

        elements.name.style.visibility = 'visible';
    }

    private _editing = false;
    private _originalText = '';

    #onEditBegin = async ():Promise<void> =>
    {
        if (this._editing === true) return;
        this._editing = true;

        const elements = this._elements;
        const storageData = this._data?.info;

        if (storageData === undefined) return;

        this._originalText = elements.name.textContent ?? '';
        if (storageData!.type === 'file') elements.name.textContent = storageData!.name; //remove the extension from the text

        //enable contenteditable
        elements.name.contentEditable = 'true';
        this._eventListenerAssistant.subscribe(elements.name, 'keydown', this.#onNameKeyDown);
        this._eventListenerAssistant.subscribe(elements.name, 'blur', this.#onEditEnd, {once:true});
        
        //focus the element to start editing
        elements.name.focus();

        //select all the text inside the element
        const range = document.createRange();
        range.selectNodeContents(elements.name);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    #onEditEnd = async ():Promise<void> =>
    {
        if (!this._editing) return;

        const elements = this._elements;

        //disable contenteditable
        elements.name.contentEditable = 'false';
        this._eventListenerAssistant.unsubscribe(elements.name, 'keydown');
        this._eventListenerAssistant.unsubscribe(elements.name, 'blur');

        const storageData = this._data?.info;
        if (storageData === undefined) return;

        let newName = elements.name.textContent?.trim() ?? '';

        if (newName.length === 0)
        {
            if (storageData.type === 'folder') newName = storageData.name; //restore the original text if the new name is empty
            else if (storageData.type === 'file') 
            {
                const storageFileData = storageData;

                if (storageFileData.extension.length === 0) newName = storageFileData.name; //restore the original name if the new name is empty and the file has no extension
            }
        }

        if (newName !== storageData.name)
        {
            const success = await this._drive.rename(storageData.path, newName, this); //rename the file/folder
            
            if (success) elements.name.textContent = storageData.extension ? storageData.name + '.' + storageData.extension : storageData.name;
            else elements.name.textContent = this._originalText; //restore the original text if the rename failed
        }
        else elements.name.textContent = this._originalText; //restore the original text if the new name is the same as the old name
        
        this._editing = false;
    }

    #onNameKeyDown = (event:KeyboardEvent):void =>
    {
        const elements = this._elements;
        const storageData = this._data!.info!;

        if (event.key === "Enter") //prevent newlines
        {
            event.preventDefault();
        
            this._eventListenerAssistant.unsubscribe(elements.name, 'blur');
            this.#onEditEnd(); //end editing
            return;
        }

        if (event.key === "Escape") //cancel editing
        {
            event.preventDefault();

            this._eventListenerAssistant.unsubscribe(elements.name, 'blur');
            elements.name.textContent = storageData.name; //restore the original name
            this.#onEditEnd();
            return;
        }

        //check if the character is allowed and if it exceeds the length limit
        const isAllowedChar = /^[a-zA-Z0-9 \-_\.\p{L}\p{N}\u00A0]$/u.test(event.key);
        const isControlChar = event.key.length > 1; //control characters like "ArrowLeft", "Backspace", etc.
        if (!isAllowedChar && !isControlChar || (elements.name.textContent!.length >= 255 && !isControlChar)) event.preventDefault();
    }

    public get drive():IDrive<A>
    {
        return this._drive;
    }

    public get id():path | emptystring
    {
        return this.name;
    }

    public set id(id:path | emptystring)
    {
        this.name = id;
    }

    public get name():path | emptystring
    {
        return super.name as path | emptystring;
    }

    public set name(name:path | emptystring)
    {
        super.name = name;
    }

    protected override get _elements():StorageTileElements { return this.__elements ?? (this.__elements = new StorageTileElements()); }
}

class Iconer<A extends IBaseApp<A>>
{
    private _app:A;
    private _storageTile:StorageTile<A, any>;
    private _abortableHelper:AbortableHelper<A>;
    private _elements:StorageTileElements;
    private _sizeElements:()=>void;
    
    private _renewUID = '';

    constructor(app:A, storageTile:StorageTile<any, any>, abortableHelper:AbortableHelper<A>, elements:StorageTileElements, sizeElements:()=>void)
    {
        this._app = app;
        this._storageTile = storageTile;
        this._abortableHelper = abortableHelper;
        this._elements = elements;
        this._sizeElements = sizeElements;
    }

    async renew(storageData:IFileInfo | IFolderInfo | undefined, visible:boolean):Promise<void| IAborted | IError>
    {
        const renewUID = this._renewUID = this._app.uidUtil.generate();
        const elements = this._elements;

        elements.name.style.visibility = 'hidden';
        elements.thumb.innerHTML = '<div class="tile-background-pulse"></div>';

        if (storageData === undefined || visible !== true) return;
        
        if (storageData.type === 'folder') return this.#setFolderIcon(renewUID, storageData);

        return this.#setFileIcon(renewUID, storageData);
    }

    #setFolderIcon = async (renewUID:string, storageData:IFolderInfo):Promise<void | IAborted | IError> =>
    {
        try
        {
            const _ = this._abortableHelper.throwIfAborted();

            const drive = this._storageTile.drive;
            const elements = this._elements;

            const folder = drive.getFolder(storageData.path);
            const info = _.value(await folder.getInfo().then(result => renewUID === this._renewUID ? result : new Aborted(this._app, 'renewUID mismatch')));

            const compressed = info.compressed;

            elements.thumb.innerHTML = '<i class=""></i>';

            if (compressed === true) elements.thumb.firstElementChild?.classList.add('bi', 'bi-archive');
            else 
            {  
                if (this._app.typeUtil.is<ISystemDrive<A>>(drive, ISystemDriveType) === true)
                {
                    if (folder === drive.rootFolder) elements.thumb.firstElementChild?.classList.add('bi', 'bi-hdd');
                    else if (folder === drive.appsFolder) elements.thumb.firstElementChild?.classList.add('bi', 'bi-window-stack');
                    else if (folder === drive.homeFolder) elements.thumb.firstElementChild?.classList.add('bi', 'bi-house');
                    else if (folder === drive.desktopFolder) elements.thumb.firstElementChild?.classList.add('bi', 'bi-window-desktop');
                    else if (folder === drive.systemFolder) elements.thumb.firstElementChild?.classList.add('bi', 'bi-motherboard');
                    else if (folder === drive.trashFolder) elements.thumb.firstElementChild?.classList.add('bi', 'bi-trash3');
                    else elements.thumb.firstElementChild?.classList.add('bi', 'bi-folder');
                }
                else elements.thumb.firstElementChild?.classList.add('bi', 'bi-folder');
            }

            this._sizeElements();
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to set folder icon', [], {names:[StorageTile, this.constructor, this.#setFolderIcon]});
        }
    }

    #setFileIcon = async (renewUID:string, storageData:IFileInfo):Promise<void | IAborted | IError> =>
    {
        try
        {
            const _ = this._abortableHelper.throwIfAborted();

            const storageFileSystem = this._storageTile.drive;

            const storageFile = storageFileSystem.getFile(storageData.path);
            const mimeType = _.value(await storageFile.getMimeType().then(result => renewUID === this._renewUID ? result : new Aborted(this._app, 'renewUID mismatch')));
            
            if (renewUID !== this._renewUID) return;

            if (!mimeType) return _.value(await this.#setGenericIcon(renewUID));

            return _.value(await this.#setThumbnailIcon(renewUID, storageData, _.value(await storageFile.getBytes(this._storageTile)), mimeType));
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to set file icon', [], {names:[StorageTile, this.constructor, this.#setFileIcon]});
        }
    }

    #setGenericIcon = async (_renewUID:string):Promise<void | IAborted | IError> =>
    {
        try
        {
            const _ = this._abortableHelper.throwIfAborted();
            this._elements.thumb.innerHTML = '<i class="bi bi-file-earmark"></i>';
            this._elements.thumb.firstElementChild?.classList.add('bi', 'bi-file-earmark');

            this._sizeElements();
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to set generic icon', [], {names:[StorageTile, this.constructor, this.#setGenericIcon]});
        }
    }
   
    #setThumbnailIcon = async (renewUID:string, storageData:IFileInfo, streamable:IDatable<ReadableStream<Uint8Array>>, mimeType:string):Promise<void | IAborted | IError> =>
    {
        try
        {
            const _ = this._abortableHelper.throwIfAborted();

            const storageFileSystem = this._storageTile.drive;

            const canvas = document.createElement('canvas');

            const storageFile = storageFileSystem.getFile(storageData.path);
            const imageBitmap = _.value(await storageFile.getThumbnail(new AbortController(this._app, () => renewUID === this._renewUID ? false : 'storage tile renewed')));

            if (renewUID !== this._renewUID) return;

            if (imageBitmap === undefined) 
            {
                this._app.consoleUtil.warn([StorageTile, this.constructor], 'image creation failed', await storageFile.getName());
            
                return _.value(await this.#setGenericIcon(renewUID));
            }

            const context = canvas.getContext('2d') ?? undefined;
            if (context === undefined) 
            {
                this._app.consoleUtil.warn([StorageTile, this.constructor], 'could not get canvas context');
                
                return _.value(await this.#setGenericIcon(renewUID));
            }

            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;
            context.drawImage(imageBitmap, 0, 0);

            const elements = this._elements;
            elements.thumb.firstElementChild?.remove(); 
            elements.thumb.appendChild(canvas);

            this._sizeElements();
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to set thumbnail icon', [], {names:[StorageTile, this.constructor, this.#setThumbnailIcon]});
        }
    }
}
