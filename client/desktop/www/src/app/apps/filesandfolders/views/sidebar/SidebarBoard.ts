/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { FitBoard, FitboardElements } from "../../../../../library/components/board/fit/FitBoard";
import type { IStorageTileData } from "../../../../../library/components/board/IStorageTileData";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { IDraggable } from "../../../../../library/components/IDraggable";
import type { IApp } from "../../../../IApp";

import html from './SidebarBoard.html';
import { SidebarTile } from "./SidebarTile";

class Elements extends FitboardElements
{
    tileTemplate!:HTMLTemplateElement;
}

@ComponentDecorator()
export class SidebarBoard<A extends IApp<A>, D extends IStorageTileData> extends FitBoard<A, D, SidebarTile<A, D>>
{
    private _tileTemplateHTML?:string;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element);
    }

	protected override preprocessHTML(element:HTMLElement):HTMLElement
	{ 
        const fragment = this._app.domUtil.createDocumentFragment(html);
        element.appendChild(fragment);

        return super.preprocessHTML(element);
	}

    public override async init():Promise<void>     
    {
        type TileConstructor = typeof SidebarTile<A, D>;

        await super.init(true, 40, 100, undefined, (data:D, getFromPool:(tileConstructor:TileConstructor) => InstanceType<TileConstructor> | undefined):[InstanceType<TileConstructor>, Promise<void>] =>
        {
            const Class = SidebarTile<A, D>;//(data.fileOrFolderData.type === 'folder') ? StandardFolderTile<R> : StandardFileTile<R>;

            let tile = getFromPool(Class);
            let promise:Promise<any>;
            if (tile) 
            {
                promise = tile.renew(data);
            }
            else
            {
                [tile, promise] = this._app.componentFactory.createComponent(this, Class, [this, this._app.userManager.systemDrive], [], [], {name:data.id, log:false});
                promise = promise.then(() => tile!.renew(data));
            }

            return [tile, promise];
        }, 
        (tile:InstanceType<TileConstructor>) =>
        {
            /*
            tile!.onDoubleClickedSignal.subscribe((tile:InstanceType<ConstructorForTile>, event:Event) => 
            {
                if (tile.data.storageData!.type !== 'folder') return;

                this._backStack.push(this._currentFolder);

                const folder = this._storageFileSystem.getFolder(tile.data.storageData!._id);
                this.#setCurrentFolder(folder);
            });
            */
        }, 
        (tile:InstanceType<TileConstructor>) =>
        {
        });

        this.spacing = [0, 0];

        /*
        const tileData:Array<ISidebarTileData> = [];
        
        const promises = [];

        promises.push(this._storageFileSystem.rootFolder.getData());
        promises.push(this._storageFileSystem.appsFolder.getData());
        promises.push(this._storageFileSystem.homeFolder.getData());
        promises.push(this._storageFileSystem.desktopFolder.getData());
        promises.push(this._storageFileSystem.trashFolder.getData());

        const results = await Promise.all(promises);
        results[0].name = 'Root';

        const app = this._app;
        for (const data of results) 
        {
            data.name = app.textUtil.capitalize(data.name);

            tileData.push({id:data._id, selected:false, storageData:data});
        }

        this._board.replace(tileData);    
        */    
    }

    public get tileTemplateHTML():string { return this._tileTemplateHTML ?? (this._tileTemplateHTML = this._elements.tileTemplate.innerHTML); }

    public override setDragData(draggable:IDraggable, event:DragEvent):void
    {
    }

    public override clearDragData():void
    {
    }

    public override get requiresManualInitialization():boolean { return false; }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}