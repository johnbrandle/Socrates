/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../../IApp.ts';
import { Component } from '../../../../library/components/Component.ts';
import html from './Desktop.html';
import { ComponentDecorator } from '../../../../library/decorators/ComponentDecorator.ts';
import type { DesktopTileable } from './DesktopTileable.ts';
import { ArrayStore } from '../../../../../../../../shared/src/library/storage/store/ArrayStore.ts';
import type { ITileable } from '../../../../library/components/board/ITileable.ts';
import { DesktopTile } from './DesktopTile.ts';
import type { IDesktopTileData } from './IDesktopTileData.ts';
import { IStorageTileType } from '../../../../library/components/board/IStorageTile.ts';
import type { IStorageTile } from '../../../../library/components/board/IStorageTile.ts';
import type { IDraggable } from '../../../../library/components/IDraggable.ts';
import type { IDraggableTarget } from '../../../../library/components/IDraggableTarget.ts';
import type { IStorageTileData } from '../../../../library/components/board/IStorageTileData.ts';
import { DebounceAssistant } from '../../../../library/assistants/DebounceAssistant.ts';
import type { Explorer } from '../Explorer.ts';
import { IContextableType, type IContextable } from '../../../../library/components/IContextable.ts';
import type { IContextMenuData } from '../../../../library/managers/IContextMenuManager.ts';
import type { IComponent } from '../../../../library/components/IComponent.ts';
import type { IInitializer } from '../../../../library/components/IInitializer.ts';
import { IInitializerType } from '../../../../library/components/IInitializer.ts';
import { Data } from '../../../../../../../../shared/src/library/data/Data.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';
import { SignalAssistant } from '../../../../library/assistants/SignalAssistant.ts';
import { DriveStorage } from '../../../../../../../../shared/src/library/storage/DriveStorage.ts';
import type { IStorage } from '../../../../../../../../shared/src/library/storage/IStorage.ts';
import { FileType, type IDriveFileInfo, type IDriveFolderInfo } from '../../../../../../../../shared/src/library/file/drive/IDrive.ts';
import type { IDriveFolder } from '../../../../../../../../shared/src/library/file/drive/IDriveFolder.ts';
import type { IDriveFile } from '../../../../../../../../shared/src/library/file/drive/IDriveFile.ts';
import { type uid } from '../../../../library/utils/UIDUtil.ts';
import { ImplementsDecorator } from '../../../../../../../../shared/src/library/decorators/ImplementsDecorator.ts';
import type { folderpath, Path, path } from '../../../../../../../../shared/src/library/file/Path.ts';
import { DevEnvironment } from '../../../../../../../../shared/src/library/IEnvironment.ts';
import type { IAbortable } from '../../../../../../../../shared/src/library/abort/IAbortable.ts';
import type { IAborted } from '../../../../../../../../shared/src/library/abort/IAborted.ts';
import type { IError } from '../../../../../../../../shared/src/library/error/IError.ts';

const TILE_SIZE = 192;

interface IDisplay extends JsonObject
{
    rows:number;
    columns:number;

    tilePositions:Record<string, {row:number, col:number}>;
}

class Elements 
{
    desktopTileable!:HTMLElement;
}

let _singleton:Desktop<any> | undefined;

@ImplementsDecorator(IContextableType, IInitializerType)
@ComponentDecorator()
export class Desktop<A extends IApp<A>> extends Component<A> implements IContextable, IInitializer
{
    private _explorer!:Explorer<A>;

    private _storage!:IStorage<A>;

    private _desktopTileable!:DesktopTileable<A, IDesktopTileData, DesktopTile<A, IDesktopTileData>>;

    private _displaysData!:ArrayStore<A, IDisplay>;

    private _signalAssistant!:SignalAssistant<A>;

    //must hold onto a reference to this or it will be garbage collected and our signal subscriptions will be lost
    private _desktopFolder!:IDriveFolder<A>;

	constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
	{
        //verify that only one instance of Explorer is active. this is before super so we don't have an issue with this being added to the destructables set
        if (_singleton !== undefined) app.throw('Only one Desktop instance can be active at a time', [], {correctable:true});

        super(app, destructor, element, html, app.configUtil.get(true).classes.Desktop.frozen.uid as uid);

        //set this instance as the active instance
        _singleton = this;
	}
	
    public vnit():void
    {
        this.set(this._elements);

        this._desktopTileable = this._elements.desktopTileable.component as DesktopTileable<A, IDesktopTileData, DesktopTile<A, IDesktopTileData>>;
    }

    public override async init(_this:IInitializer, desktopTileable:DesktopTileable<A, any, any>):Promise<void>;
    public override async init(explorer:Explorer<A>):Promise<void>;
    public override async init(...args:any):Promise<void>
    {
        if (args[0] === this) return args[1].init();

        await super.init();

        const app = this._app;

        this._signalAssistant = new SignalAssistant(app, this);

        const explorer = args[0];

        this._desktopFolder = this._app.userManager.systemDrive.desktopFolder;

        app.contextMenuManager.add(this);

        this._explorer = explorer;

        const data = new Data(app, async () => this._app.streamUtil.fromUint8Array(app.textUtil.toUint8Array(app.jsonUtil.stringify({}))));
        const filePath = app.userManager.systemDrive.systemFolderPath.getSubFile('desktop.json');
        const success = await app.userManager.systemDrive.createFileIfNotExists(filePath, {immutable:false, hidden:false, type:FileType.Other, mimeType:'application/json'}, data, this);
        if (!success) app.throw('Could not create desktop.json', []);

        this._storage = new DriveStorage(this._app, this.uid, app.userManager.systemDrive, filePath);
        this._displaysData = this.abortableHelper.value(await (new ArrayStore<A, IDisplay>(this._storage, 'displays', undefined, true)).restore());
    }

    public override async fnit(_this:IInitializer, component:IComponent<A>):Promise<void>;
    public override async fnit():Promise<void>;
    public override async fnit(...args:any):Promise<void>
    {
        type D = IDesktopTileData;
        type T = DesktopTile<A, D>;

        if (args[0] === this) 
        {
            const desktopTileable = args[1] as DesktopTileable<A, IDesktopTileData, DesktopTile<A, IDesktopTileData>>;
            type ConstructorForTile = new (app:A, destructor:IDestructor<A>, element:HTMLElement, tileable:ITileable<A, D, T>, ...args:any[]) => T;
            return desktopTileable.fnit(TILE_SIZE, this, (data:D, getFromPool:(tileConstructor:ConstructorForTile) => InstanceType<ConstructorForTile> | undefined):[InstanceType<ConstructorForTile>, Promise<void>] =>
            {
                const Class = DesktopTile<A, D>;
    
                let tile = getFromPool(Class);
                let promise:Promise<any>;
                if (tile) 
                {
                    promise = tile.renew(data);
                }
                else
                {
                    [tile, promise] = this._app.componentFactory.createComponent<ConstructorForTile>(this, Class, [desktopTileable, this._app.userManager.systemDrive], [], [], {name:data.id, log:false});
                    promise = promise.then(() => tile!.renew(data));
                }
    
                return [tile, promise];
            }, (tile:InstanceType<ConstructorForTile>) =>
            {
    
            }, (tile:InstanceType<ConstructorForTile>) =>
            {
            });
        }

        return super.fnit();
    }

    public override async ready():Promise<void>
    {
        const signalAssistant = this._signalAssistant;

        signalAssistant.subscribe(this._desktopTileable.onDropSignal, this.#onDrop);
        
        signalAssistant.subscribe(this._desktopFolder.onChildModifiedSignal, this._redraw.execute);
        signalAssistant.subscribe(this._desktopFolder.onChildRenamedSignal, (_parent:IDriveFolder<A>, fromPath:Path, toPath:Path) => 
        {
            try
            {
                const _ = this.abortableHelper.throwIfAborted();

                const fromPathString = fromPath.toString();
                const toPathString = toPath.toString();

                //update the tile position data to match the new uid
                const displayData = this.getDisplayData();
                const tilePositions = displayData.tilePositions;
                if (tilePositions[fromPathString] !== undefined)
                {
                    //set the new path to the old path's position
                    tilePositions[toPathString] = tilePositions[fromPathString];
                    delete tilePositions[fromPathString];

                    //clear tile
                    this._desktopTileable.getTileAt(tilePositions[toPathString].col, tilePositions[toPathString].row)!.renew({id:'', selected:false, info:undefined, invalidated:true});
                }

                this._redraw.execute();
            }
            catch (error)
            {
                this._app.warn(error, 'Could not rename desktop item', [], {names:[this.constructor, this.ready, 'onChildRenamedSignal']});
            }
        });
        signalAssistant.subscribe(this._desktopFolder.onChildAddedSignal, this._redraw.execute);
        signalAssistant.subscribe(this._desktopFolder.onChildRemovedSignal, this._redraw.execute);

        this._redraw.execute();

        return super.ready();
    }

    public isInitializerForComponent(component:IComponent<A>):boolean 
    {
        return component === this._desktopTileable;
    }

    private _redraw = new DebounceAssistant<A, [IDriveFolder<A>, Path] | []> (this, async (abortable:IAbortable, _driveFolder?:IDriveFolder<A>, _path?:Path):Promise<true | IAborted | IError> => 
    {
        try
        {
            if (this.initialized !== true) this._app.throw('Cannot redraw desktop. Desktop is not initialized', []);
         
            const _ = this.createAbortableHelper(abortable).throwIfAborted();

            //populate desktop board with tiles
            const desktopTileable = this._desktopTileable;
            const displayData = this.getDisplayData(); //now that the desktopBoard is intialized, we can find or create a display data structure that matches the desktop board size

            const childInfo:Array<IDriveFolderInfo | IDriveFileInfo> = [];
            for await (const info of this._desktopFolder.getChildrenInfo(this)) childInfo.push(_.value(info));

            const tilePositions = displayData.tilePositions;

            //loop through the tiles and see if there is child data for each one. if there is, renew it with the updated child data, otherwise clear it
            const tiles = desktopTileable.tiles;
            for (let i = tiles.length; i--;)
            {
                const tile = tiles[i];
                const tileData = tile.data;

                //if the tile is empty, skip it
                if (tileData.info === undefined) continue;

                //check if one of the child info path matches the tile id
                let found = false;
                for (let j = childInfo.length; j--;)
                {
                    const childData = childInfo[j];

                    if (childData.path !== tileData.id) continue;

                    found = true;
                    
                    tilePositions[tileData.id] = this._desktopTileable.getRowColumnOfTile(tile);
                    tile.renew({id:tileData.id, selected:tileData.selected, info:childData, invalidated:true});
                    childInfo.splice(j, 1);
                    break;
                }

                if (!found) //the tile is no longer in the folder, so remove it from the desktop
                {
                    delete tilePositions[tile.id];
                    tile.renew({id:'', selected:false, info:undefined, invalidated:true}); //clear tile
                }
            }

            //place icons in their positions
            for (let i = childInfo.length; i--;) 
            {
                const childData = childInfo[i];

                const position:{row:number, col:number} | undefined = displayData.tilePositions[childData.path];
                if (!position || !desktopTileable.isTilePositionAvailable(position.col, position.row)) continue;

                childInfo.splice(i, 1);
                tilePositions[childData.path] = position;

                desktopTileable.getTileAt(position.col, position.row)!.renew({id:childData.path, selected:false, info:childData, invalidated:true});
            }

            //place remaining icons in available positions
            while (childInfo.length)
            {
                const position = desktopTileable.getFirstAvailableTilePosition();
                if (!position) break;

                const childData = childInfo.shift()!;
                tilePositions[childData.path] = position;

                desktopTileable.getTileAt(position.col, position.row)!.renew({id:childData.path, selected:false, info:childData, invalidated:true});
            }

            displayData.tilePositions = tilePositions;
            _.check(await this._displaysData.commit()); //save changes

            return true;
        }
        catch (e)
        {
            return this._app.warn(e, 'Could not redraw desktop', [], {names:[this.constructor, '_redraw']});
        }
    }, {throttle:true, delay:true, id:'_redraw'});

    #onDrop = async(_draggableTarget:IDraggableTarget, draggable:IDraggable | undefined, droppedOnDraggable:IDraggable | undefined, event:DragEvent):Promise<void> =>
    {
        type D = IDesktopTileData;
        type T = DesktopTile<A, D>;

        const isTileAlreadyClosestToPosition = (tile:T, x:number, y:number) =>
        {
            //first, get the closest tile position (even if it is occupied)
            const position = this._desktopTileable.getClosestTilePosition(x, y);

            //second, check if what we are dragging is in that position
            const draggablePosition = this._desktopTileable.getRowColumnOfTile(tile);

            return draggablePosition && draggablePosition.row === position.row && draggablePosition.col === position.col;
        }

        const isTileBeingDragged = (T:T, dragging:Array<D>) =>
        {
            for (let i = dragging.length; i--;)
            {
                if (dragging[i].id === T.data.id) return true;
            }

            return false;
        }

        const swapTiles = async (dragTile:T, droppedOnTile:T, dragging:Array<D>) =>
        {
            if (isTileBeingDragged(droppedOnTile, dragging)) this._app.throw('Cannot swap tiles. You are trying to drag a tile you are dragging onto another tile you are dragging', []);
            
            const {row:dragRow, col:dragCol} = this._desktopTileable.getRowColumnOfTile(dragTile);
            const {row:dropRow, col:dropCol} = this._desktopTileable.getRowColumnOfTile(droppedOnTile);

            if (droppedOnTile.data.info !== undefined)
            {
                displayData.tilePositions[dragTile.id] = {row:dropRow, col:dropCol}; //update position of fromTile to toTile's position
                displayData.tilePositions[droppedOnTile.data.id] = {row:dragRow, col:dragCol}; //update position of toTile to fromTile's position
    
                await this._displaysData.commit(); //save changes
            
                const data = droppedOnTile.data;
                await droppedOnTile.renew(dragTile.data);
                await dragTile.renew(data);
    
                return; 
            }
    
            //dropTile not occupied, move fromTile to toTile
            const id = dragTile.id;
            await droppedOnTile.renew(dragTile.data); //set data of toTile to fromTile's data
            await dragTile.renew({id:'', selected:false, info:undefined, invalidated:true}); //clear dragTile

            displayData.tilePositions[id] = {row:dropRow, col:dropCol};
        }

        const displayData = this.getDisplayData();
        const fileSystem = this._app.userManager.systemDrive;

        // state:
        // - we are dragging from somewhere to the desktop
        // - we are dragging to an empty space, a file, a folder, the same tile position, or a draggableTarget
        // - we are dragging something which we have yet to identify

        // strategy:
        // - verify what is being dragged is a storage tile. if it isn't, handle that case.

        if (this._app.typeUtil.is<IStorageTile<A, IStorageTileData>>(draggable, IStorageTileType) !== true)
        {
            const dataTransfer = event.dataTransfer ?? undefined;

            if (dataTransfer === undefined || dataTransfer.items.length < 1) return; //nothing to do

            // state:
            // - we are dragging from somewhere outside the app to the desktop
            // - we are dragging to an empty space, a file, a folder, the same tile position, or a draggableTarget
            // - we are dragging something which we have yet to identify

            // strategy:
            // - attempt to add the items if they are files

            const readFileData = (entry:FileSystemFileEntry) => new Promise<File | undefined>((resolve, _reject) => entry.file((file:File) => resolve(file), (error:Error) => resolve(undefined)));
        
            const handleFile = async (entry:FileSystemFileEntry, folder:IDriveFolder<A>, onProgress:(progress:number) => void):Promise<boolean> =>
            {
                const file = await readFileData(entry as FileSystemFileEntry);
                if (file === undefined) 
                {
                    this.warn('Could not read file', entry.name);
                    return false;
                }
               
                const data = new Data(this._app, async () => file.stream());

                if (entry.name.length === 0) return false; //should not occur

                return folder.createFile(entry.name, {immutable:false, hidden:false, type:FileType.Unclassified, mimeType:file.type}, data, this).then((file) => file !== undefined);
            }

            const handleFolder = async (entry:FileSystemDirectoryEntry, folder:IDriveFolder<A>, onProgress:(progress:number) => void):Promise<void> =>
            {
                const reader = entry.createReader();
                const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
                for (let i = 0; i < entries.length; i++) 
                {
                    const entry = entries[i];
                    if (entry.isDirectory) 
                    {
                        const childFolder = await folder.createFolder(entry.name, {immutable:true, hidden:false, compressed:false, app:false, extra:{}});
                        if (childFolder === undefined) this._app.throw('Could not create folder', []);

                        await handleFolder(entry as FileSystemDirectoryEntry, childFolder, onProgress);
                    }
                    else await handleFile(entry as FileSystemFileEntry, folder, onProgress);
                }
            }

            let targetFolder = this._desktopFolder;
            if (droppedOnDraggable !== undefined)
            {
                if (droppedOnDraggable !== undefined && this._app.typeUtil.is<IStorageTile<A, IStorageTileData>>(droppedOnDraggable, IStorageTileType))
                {
                    const droppedOnTile = droppedOnDraggable as IStorageTile<A, IStorageTileData>;

                    if (droppedOnTile.data.info !== undefined)
                    {
                        if (droppedOnTile.data.info.type === 'folder') targetFolder = fileSystem.getFolder(droppedOnTile.data.info.path);
                    }
                }
            }

            const items = dataTransfer.items;
            for (let i = 0; i < items.length; i++) 
            {
                const item = items[i];
                if (item.kind !== 'file') continue; 
                
                const entry = item.webkitGetAsEntry();
          
                if (!entry) continue;
    
                if (entry.isFile === true) handleFile(entry as FileSystemFileEntry, targetFolder, () => {});
                else if (entry.isDirectory === true) 
                {
                    const childFolder = await targetFolder.createFolder(entry.name, {immutable:true, hidden:false, compressed:false, app:false, extra:{}});
                    if (childFolder === undefined) this._app.throw('Could not create folder', []);

                    await handleFolder(entry as FileSystemDirectoryEntry, childFolder, () => {});
                }
                else this._app.throw('Unknown entry type', []);
            }

            return;
        }

        // check if we are dropping on a folder
        let wasDroppedOnFolder = false;
        if (droppedOnDraggable !== undefined && this._app.typeUtil.is<IStorageTile<A, IStorageTileData>>(droppedOnDraggable, IStorageTileType))
        {
            const droppedOnTile = droppedOnDraggable as IStorageTile<A, IStorageTileData>;
            if (droppedOnTile.data.info !== undefined)
            {
                if (droppedOnTile.data.info.type === 'folder') wasDroppedOnFolder = true;
            }
        }

        // state:
        // - we are dragging from somewhere to the desktop
        // - we are dragging to an empty space, a file, a folder, the same tile position, or a draggableTarget
        // - we are dragging one or more files/folders

        // strategy:
        // - verify if we are dragging from the desktop. do this by checking if the draggable is a desktop tile

        if (!this._app.typeUtil.is<T>(draggable, DesktopTile)) 
        {
            const dragTile = draggable as IStorageTile<A, IStorageTileData>;
            const dragTileDatas = draggable.tileable.selected;

            if (wasDroppedOnFolder) 
            {
                //todo, attempt to copy the files to the folder
                return;
            }

            // state:
            // - we are dragging from somewhere else to desktop
            // - we are dragging to an empty space, a file, a folder, or a draggableTarget
            // - we are dragging one or more files/folders

            // strategy:
            // - set the drop tile to the closest position to the drop position (even if it is occupied)

            if (droppedOnDraggable === undefined) //dropped on empty area
            {
                const position = this._desktopTileable.getClosestTilePosition(event.clientX, event.clientY);
                droppedOnDraggable = this._desktopTileable.getTileAt(position.col, position.row);
            }   

            const toFolder = this._desktopFolder;
            for (let i = dragTileDatas.length; i--;)
            {
                const dragTileData = dragTileDatas[i];
                if (dragTileData.info === undefined) 
                {
                    this.warn('Cannot move tile. Tile data does not have storage data');
                    continue; //should not occur
                }

                const tileID = dragTileData.info.path;
                const folderOrFile = fileSystem.getFileOrFolder(dragTileData.info.path);
                let success = await toFolder.add(folderOrFile, this);
                if (!success) //this should not occur
                {
                    this.warn('Could not add file or folder to folder');
                    continue;
                }

                let position = this._desktopTileable.getClosestAvailableTilePosition(event.clientX, event.clientY, false);
               
                if (position === undefined) continue; //no available positions. that is okay

                displayData.tilePositions[tileID] = {row:position.row, col:position.col};
                await dragTile.renew({id:tileID, selected:true, info:await folderOrFile.getInfo(), invalidated:true}); //clear dragTile
            }

            await this._displaysData.commit(); //save changes
            return;
        }

        const dragTile = draggable as T;
        const dragTileDatas = dragTile.tileable.selected;

        // state:
        // - we are dragging from desktop to desktop
        // - we are dragging to an empty space, a file, a folder, the same tile position, or a draggableTarget
        // - we are dragging one or more files/folders

        // strategy:
        // - check if dragTile is already in the closest position to the drop position. if so, abort. the tile we are dragging is already in the closest position to drop position
        
        if (isTileAlreadyClosestToPosition(dragTile, event.clientX, event.clientY)) return;

        // state:
        // - we are dragging from desktop to desktop
        // - we are dragging to an empty space, a file, a folder, or a draggableTarget
        // - we are dragging one or more files/folders

        // strategy:
        // - check if droppedOnDraggable is undefined. it will be undefined if we did not drop on a draggable item
       
        if (droppedOnDraggable === undefined) 
        {
            // state:
            // - we are dragging from desktop to desktop
            // - we are dragging to a draggableTarget
            // - we are dragging one or more files/folders

            // strategy:
            // - set the drop tile to the closest available position, and if none available, then the closest position to the drop position (even if it is occupied)

            let position = this._desktopTileable.getClosestAvailableTilePosition(event.clientX, event.clientY, true);
            droppedOnDraggable = this._desktopTileable.getTileAt(position.col, position.row);
        }

        const droppedOnTile = droppedOnDraggable as T;

        // state:
        // - we are dragging from desktop to desktop
        // - we are dragging to an empty space, a file, or a folder
        // - we are dragging one or more files/folders

        // strategy:
        // - check if we are dragging into a folder, if so, move the dragged files into the folder
        // - however, ensure that the dropped on tile is not one of the dragged tiles (for instance, imagine you have two folder tiles in a column, and you drag one position downward, you would be dragging onto a folder, but it is also one of the dragged tiles, so we don't want to move the dragged tiles into the folder)

        if (!isTileBeingDragged(droppedOnTile, dragTileDatas) && wasDroppedOnFolder) 
        {
            const fileSystem = this._app.userManager.systemDrive;
         
            const toPath = droppedOnTile.data.info!.path as folderpath;
            const toFolder = fileSystem.getFolder(toPath);
            for (let i = dragTileDatas.length; i--;)
            {
                const dragTileData = dragTileDatas[i];
                if (dragTileData.info === undefined) 
                {
                    this.warn('Cannot move tile. Tile data does not have storage data');
                    continue; //should not occur
                }

                const tile = this._desktopTileable.getTileByData(dragTileData);
                if (tile === undefined)
                {
                    this.warn('Cannot move tile. Tile not found');
                    continue; //should not occur
                }

                const tileID = tile.id;
                const folderOrFile = fileSystem.getFileOrFolder(dragTileData.info.path);
                let success = await toFolder.add(folderOrFile, this);
                if (!success) //this should not occur
                {
                    this.warn('Could not add file or folder to folder');
                    continue;
                }

                delete displayData.tilePositions[tileID];
                await tile.renew({id:'', selected:false, info:undefined, invalidated:true}); //clear dragTile
            }

            await this._displaysData.commit(); //save changes
            return;
        }

        // state:
        // - we are dragging from desktop to desktop
        // - we are dragging to an empty space or a file
        // - we are dragging one or more files/folders

        // strategy:
        // - move each dragged file to the closest position to the drop position
        // - if a position is occupied, swap positions with the file in that position
        // - files should be moved relative to where they were. so if i move three files, they would ideally be dropped in the same relative positions to each other.
        // - if a relative space is not available, try the closest available position to where it would be. if there are no available positions, don't move it.

        let id = dragTile.id; //the id will change once we swap/renew the tile, so we need to store it here

        const {row:dragRow, col:dragCol} = this._desktopTileable.getRowColumnOfTile(dragTile);
        const {row:dropRow, col:dropCol} = this._desktopTileable.getRowColumnOfTile(droppedOnTile);

        const rowDiff = dropRow - dragRow;
        const colDiff = dropCol - dragCol;

        let count = 0;
        let slicedDragTileDatas = dragTileDatas.slice(); 
        let placedTiles = []; //tiles that have been placed in their final position
        while (slicedDragTileDatas.length)
        {
            count++;
            if (count > 10000) 
            {
                this._app.consoleUtil.error(this.constructor, 'Infinite loop detected in drop operation'); //in case a bug (now or in the future) causes an infinite loop, we don't want to be stuck here
                debugger;
                break;
            }

            for (let i = slicedDragTileDatas.length; i--;)
            {
                const tileData = slicedDragTileDatas[i];

                const tile = this._desktopTileable.getTileByData(tileData)!;
                const {col:tileCol, row:tileRow} = this._desktopTileable.getRowColumnOfTile(tile);
                let newCol = tileCol + colDiff;
                let newRow = tileRow + rowDiff;

                //this is the ideal placement. if this is unavailable or occupied, find the closest available position (unless it is occupied by a dragging tile we have yet to place)
                let newTile = this._desktopTileable.getTileAt(newCol, newRow); //get the tile at the calculated relative postion

                if (newTile && placedTiles.indexOf(newTile.id) !== -1) newTile = undefined; //the tile exists, but it is occupied by a tile we already placed, so we can't place this tile here
                if (newTile && isTileBeingDragged(newTile, slicedDragTileDatas)) continue; //if the closest available tile is one of the dragged tiles, skip it

                if (!newTile)
                {
                    //clamp newRow and newCol
                    if (newRow < 0) newRow = 0;
                    else if (newRow >= this._desktopTileable.rows) newRow = this._desktopTileable.rows - 1;

                    if (newCol < 0) newCol = 0;
                    else if (newCol >= this._desktopTileable.cols) newCol = this._desktopTileable.cols - 1;

                    const xAndY = this._desktopTileable.getTileXAndY(newCol, newRow);
                    const closestAvailablePositions = this._desktopTileable.getClosestAvailableTilePositions(xAndY.x, xAndY.y);
                    
                    for (let j = 0, length = closestAvailablePositions.length; j < length; j++)
                    {
                        const closestAvailablePosition = closestAvailablePositions[j];

                        let eachTile = this._desktopTileable.getTileAt(closestAvailablePosition.col, closestAvailablePosition.row)!;
                        if (placedTiles.indexOf(eachTile.id) !== -1) continue; //if the closest available tile is one of the placed tiles, we did not find a valid tile
                        if (isTileBeingDragged(eachTile, slicedDragTileDatas)) continue; //if the closest available tile is one of the dragged tiles, skip it

                        newTile = eachTile;
                        break;
                    }

                    if (!newTile)
                    {
                        placedTiles.push(tileData.id);
                        slicedDragTileDatas.splice(i, 1);
                        continue;
                    }
                }

                placedTiles.push(tileData.id);
                slicedDragTileDatas.splice(i, 1);
                await swapTiles(tile, newTile, slicedDragTileDatas);
            }
        }
            
        await this._displaysData.commit(); //save changes
    }

    public onContextMenu(event:MouseEvent):IContextMenuData | undefined
    {
        const target = (event.target ?? undefined) as Element | undefined;
        if (target === undefined) return;

        if (!this.element.contains(target)) return;

        let contextMenuData:IContextMenuData | undefined;

        let hasIconSpecificContextMenu = false;
        let icon = this._desktopTileable.getTileAtCoordinates(event.clientX, event.clientY);
        if (icon) 
        {
            contextMenuData = icon.onContextMenu(event);
            if (contextMenuData) hasIconSpecificContextMenu = true;
        }
        if (!contextMenuData) contextMenuData = {items:[]};

        let items = contextMenuData.items;

        if (hasIconSpecificContextMenu)
        {
            //items.push({}); //separator (add if you end up adding shared items below)
            //push shared content menu items here (items you want showing when they right click on an icon or nothing)
        }
        else
        {
            items.push(
                {label:'New', items: 
                [
                    {label:'Folder', action:() => void this.createNew(event.clientX, event.clientY, false)},
                    {label:'Zipped Folder', action:() => void this.createNew(event.clientX, event.clientY, true)},
                    {},
                    {label:'Text File', action:() => void this.createNew(event.clientX, event.clientY)},
                ]},
                {},
                {label:"Open in Terminal"},
                {label:"Open in Files & Folders"},
                {},
                {label:"Options..."},
                {label:"Properties..."},
            );

            if (this._app.environment.frozen.devEnvironment !== DevEnvironment.Prod) items.push({}, {label:'Debug', items:
            [
                {label:'Show Grid Outline', action:() => void this.showGridOutline()},
            ]});
        }
        return contextMenuData;
    }

    private getDisplayData():IDisplay
    {
        //first look for matching display in metadata
        let display = this._displaysData.find(display => display.rows === this._desktopTileable.rows && display.columns === this._desktopTileable.cols);
        if (display) return display;

        //if none found, find the first display that can fit the desktop
        display = this._displaysData.find(display => display.rows <= this._desktopTileable.rows && display.columns <= this._desktopTileable.cols); 
         
        //create a new display if one is found, copied from the found display
        if (display) 
        {
            display = {rows:display.rows, columns:display.columns, tilePositions:JSON.parse(JSON.stringify(display.tilePositions))};
            this._displaysData.add(display);
            
            return display;
        }
         
        //if none found, create a new display
        display = {rows:this._desktopTileable.rows, columns:this._desktopTileable.cols, tilePositions:{}};
        this._displaysData.add(display);

        return display; 
    }

    public async createNew(clientX:number, clientY:number, compressed:boolean):Promise<IDriveFolder<A> | IAborted | IError>;
    public async createNew(clientX:number, clientY:number):Promise<IDriveFile<A> | IAborted | IError>;
    public async createNew(clientX:number, clientY:number, compressed?:boolean | undefined):Promise<IDriveFolder<A> | IDriveFile<A> | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const desktopFolder = this._desktopFolder;

            const displayData = this.getDisplayData();

            //begin by trying to put it in the closest available position. if none are available, put it in the closest position and boot the other tile
            let closestPosition = this._desktopTileable.getClosestAvailableTilePosition(clientX, clientY, false);
            if (closestPosition === undefined) //no available positions
            {
                closestPosition = this._desktopTileable.getClosestTilePosition(clientX, clientY);

                const tile = this._desktopTileable.getTileAt(closestPosition.col, closestPosition.row)!;
                delete displayData.tilePositions[tile.id];
            }

            const getNextAvailableName = async (folder:IDriveFolder<A>, proposedName:string, extension=''):Promise<string | IAborted | IError> =>
            {
                const set:Set<string> = new Set();
                const generator = folder.getChildrenInfo(this, {hidden:true});
                for await (let info of generator) 
                {
                    info = _.value(info);

                    set.add(info.name);
                }

                let name = extension ?`${proposedName}.${extension}` : proposedName;
                let i = 1;
                let found = true;
                while (found === true)
                {

                    found = set.has(name);
                    if (found) name = extension ? `${proposedName} ${i}.${extension}` : `${proposedName} ${i}`;

                    i++;
                }

                return name;
            }

            const createFile = async (col:number, row:number):Promise<IDriveFile<A> | IAborted | IError> =>
            {
                const proposedName = 'New Text File';
                const name = _.value(await getNextAvailableName(desktopFolder, proposedName, 'txt'));

                const data = new Data(this._app, async () => this._app.streamUtil.createEmpty());
                const file = _.value(await desktopFolder.createFile(name, {type:FileType.Other, immutable:false, hidden:false, mimeType:'text/plain'}, data, this));

                displayData.tilePositions[file.path.toString()] = {col:col, row:row};
                
                this._redraw.execute(); //redraw will commit the displayData change

                return file;
            }

            const createFolder = async (col:number, row:number, compressed:boolean):Promise<IDriveFolder<A> | IAborted | IError> =>
            {
                const proposedName = compressed ? 'New Zipped Folder' : 'New Folder';
                const name = _.value(await getNextAvailableName(desktopFolder, proposedName));

                const folder = _.value(await desktopFolder.createFolder(name, {immutable:false, hidden:false, compressed, app:false, extra:{}}));

                displayData.tilePositions[folder.path.toString()] = {col:col, row:row};

                this._redraw.execute(); //redraw will commit the displayData change

                return folder;
            }

            return compressed === undefined ? createFile(closestPosition.col, closestPosition.row) : createFolder(closestPosition.col, closestPosition.row, compressed);
        }
        catch (error)
        {
            return this._app.warn(error, 'Could not create new file or folder', [], {names:[this.constructor, 'createNew']});
        }
    }

    public override async dnit():Promise<boolean>
    {
        if (await super.dnit(false) !== true) return false;

        _singleton = undefined; //so we can create another instance of Desktop

        return true;
    }

    public showGridOutline():void
    {
        this._desktopTileable.showGridOutline();
    }

    public get explorer():Explorer<A>
    {
        return this._explorer;
    }

    public get requiresManualInitialization():boolean { return true; }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}

