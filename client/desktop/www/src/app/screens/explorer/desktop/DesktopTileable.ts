/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */
	
import { Component } from "../../../../library/components/Component";
import type { TileConstructor} from "../../../../library/components/board/IBoard";
import { ComponentDecorator } from "../../../../library/decorators/ComponentDecorator";
import { ITileableType } from "../../../../library/components/board/ITileable";
import type { Desktop } from "./Desktop";
import type { ISignal } from "../../../../../../../../shared/src/library/signal/ISignal";
import { Signal } from "../../../../../../../../shared/src/library/signal/Signal";
import { IDraggableTargetType } from "../../../../library/components/IDraggableTarget";
import type { IApp } from "../../../IApp";
import type { IDraggable } from "../../../../library/components/IDraggable";
import type { IDraggableTarget } from "../../../../library/components/IDraggableTarget";
import type { DesktopTile } from "./DesktopTile";
import type { IDesktopTileData } from "./IDesktopTileData";
import { EventListenerAssistant } from "../../../../library/assistants/EventListenerAssistant";
import { ISSUE_TEXT } from "../../../../library/managers/IDragAndDropManager";
import type { ITileable } from "../../../../library/components/board/ITileable";
import { DragAssistant } from "../../../assistants/DragAssistant";
import html from './DesktopTileable.html';
import type { IDestructor } from "../../../../../../../../shared/src/library/IDestructor";
import { GlobalEvent } from "../../../../library/managers/GlobalListenerManager";
import { ImplementsDecorator } from "../../../../../../../../shared/src/library/decorators/ImplementsDecorator";

const ICON_SCALING_FACTOR = 1;
const THUMB_SCALING_FACTOR = 1.5;

class Elements
{
    tileTemplate!:HTMLTemplateElement;
    tileContainer!:HTMLDivElement;
}

@ComponentDecorator()
@ImplementsDecorator(ITileableType, IDraggableTargetType)
export class DesktopTileable<A extends IApp<A>, D extends IDesktopTileData, T extends DesktopTile<A, D>> extends Component<A> implements ITileable<A, D, T>
{
    public getTile!:(data:D, getFromPool:(tileConstructor:TileConstructor<A, D, T>) => InstanceType<TileConstructor<A, D, T>> | undefined) => [InstanceType<TileConstructor<A, D, T>>, Promise<void>];
    public onTileRenewed!:(tile:InstanceType<TileConstructor<A, D, T>>) => void; //function to renew a tile
    public onTileReturned!:(tile:InstanceType<TileConstructor<A, D, T>>) => void; //function to dispose of a tile

    private _rows = 0;
    private _cols = 0;
    private _tiles:InstanceType<TileConstructor<A, D, T>>[] = []; //all icons

    private _tileSize = 0;

    private _desktop!:Desktop<A>;

    public readonly onDropSignal:ISignal<[IDraggableTarget, draggable:IDraggable | undefined, toDraggable:IDraggable | undefined, dragEvent:DragEvent]> = new Signal(this);

    public _eventListenerAssistant!:EventListenerAssistant<A>;

    private _url:string | undefined;

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

    public override init():Promise<void>
    {
        this.set(this._elements);

        this._eventListenerAssistant = new EventListenerAssistant(this._app, this);

        return super.init();
    }

    public override async fnit(tileSize:number, desktop:Desktop<A>, getTile?:(data:D, getFromPool:(tileConstructor:TileConstructor<A, D, T>) => InstanceType<TileConstructor<A, D, T>> | undefined) => [InstanceType<TileConstructor<A, D, T>>, Promise<void>], onTileRenewed?:(tile:InstanceType<TileConstructor<A, D, T>>) => void, onTileReturned?:(tile:InstanceType<TileConstructor<A, D, T>>) => void):Promise<void>
    {
        this._desktop = desktop;

        this._tileSize = tileSize;

        //px reserved for appbar and controlbar
        const rows = this._rows = Math.floor((window.screen.availHeight - (window.screen.availHeight / 4)) / tileSize); //calculating how many icons can fit
        const cols = this._cols = Math.floor((window.screen.availWidth - (window.screen.availWidth / 4)) / tileSize); //number of columns

        this.getTile = getTile ?? this.getTile;
        this.onTileReturned = onTileReturned ?? this.onTileReturned;
        this.onTileRenewed = onTileRenewed ?? this.onTileRenewed;

        const tileContainer = this._elements.tileContainer;
        tileContainer.style.setProperty('--rows', rows.toString());
        tileContainer.style.setProperty('--cols', cols.toString());
        tileContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        tileContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

        //create tiles
        const tileCount = rows * cols;
        const promises:Array<Promise<any>> = [];
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < tileCount; i++) 
        {
            const [tile, promise] = this.getTile({id:'', selected:false, info:undefined} as D, () => undefined);
            
            this._tiles.push(tile);
            fragment.appendChild(tile.element);

            promises.push(promise);
        }
        tileContainer.appendChild(fragment);

        await Promise.all(promises);

        const explorerElement = this._desktop.explorer.element;
        this._eventListenerAssistant.subscribe(explorerElement, 'drop', this.#onExplorerDrop);
        this._eventListenerAssistant.subscribe(explorerElement, 'click', this.#handleTileSelectionLogic);
        this._eventListenerAssistant.subscribe(explorerElement, 'dragstart', this.#onExplorerDragStart, {capture:true});
        this._eventListenerAssistant.subscribe(explorerElement, 'contextmenu', this.#handleTileSelectionLogic);

        const selectionSVG = desktop.explorer.selectionSVG;
        new DragAssistant(this._app, this, explorerElement, 
        (_dragAssistant, event) => //down
        {
            const target = event.target;

            if (!(target instanceof HTMLElement)) return false;

            if (!this._desktop.explorer.desktopArea.contains(target)) return false; //they clicked on something else
        }, (_dragAssistant, event) => //start
        {
            if (!event.shiftKey) 
            {
                this.selected = [];
                return;
            }

            this._wasSelected.clear();
            const tiles = this._tiles;    
            for (const tile of tiles)
            {
                if (tile.selected) this._wasSelected.add(tile);
            }
        }, (_dragAssistant, event, startX, startY, deltaX, deltaY, currentX, currentY) => //drag
        {
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            const svgX = Math.min(startX, currentX);
            const svgY = Math.min(startY, currentY);
        
            //update SVG dimensions and position
            selectionSVG.style.left = svgX + 'px';
            selectionSVG.style.top = svgY + 'px';
            selectionSVG.setAttribute('width', String(width));
            selectionSVG.setAttribute('height', String(height));

            this.#selectTiles(selectionSVG.getBoundingClientRect());
        }, (_dragAssistant, event) => //end
        {
            this.#selectTiles(selectionSVG.getBoundingClientRect());

            selectionSVG.setAttribute('width', '0');
            selectionSVG.setAttribute('height', '0');
        }, 5);

        this._app.globalListenerManager.subscribe(this, GlobalEvent.Resize, (event:Event) => this.onResizeListened(event));

        return super.fnit();
    }

    public override async ready():Promise<void>
    {
        await super.ready();
    }

    #onExplorerDrop = (event:DragEvent) =>
    {
        event.stopImmediatePropagation();

        this._app.dragAndDropManager.onDragTargetDropped(this, event);
    }

    #onExplorerDragStart = (event:DragEvent) =>
    {
        const tile = this._app.tileUtil.get<A, D, T>(event.target as HTMLElement, this);
        if (tile === undefined) return;

        if (!tile.selected) this.selected = []; //they are dragging, but the tile they are dragging on is not selected, so deselect all other tiles and select this one
    }

    //If the shiftKey is held, it toggles the selected status of the clicked tile (if it has storageData).
    //If no keys are held, and the tile has storageData but is already selected, do nothing.
    //If no keys are held and the tile has storageData, deselect all other tiles and select the clicked tile.
    #handleTileSelectionLogic = (event:MouseEvent) =>
    {
        const tile = this._app.tileUtil.get<A, D, T>(event.target as HTMLElement, this);
        if (tile === undefined) return;

        if (event.shiftKey)
        {
            if (tile.data.info !== undefined) tile.selected = !tile.selected;
            return;
        }
        if (event.type !== 'contextmenu') this.selected = [];
        if (tile.data.info !== undefined) tile.selected = true;
    }

    private readonly _wasSelected:Set<InstanceType<TileConstructor<A, D, T>>> = new Set();
    #selectTiles = (selectionRect:DOMRect) =>
    {
        requestAnimationFrame(() => //must do this after a frame, because click will call immediatly after this, clearing the selection
        {
            const wasSelected = this._wasSelected;
            const tiles = this._tiles;    
            for (const tile of tiles)
            {
                if (tile.data.info === undefined) continue;

                const tileRect = tile.element.getBoundingClientRect();

                if (tileRect.left > selectionRect.right || tileRect.right < selectionRect.left || tileRect.top > selectionRect.bottom || tileRect.bottom < selectionRect.top) 
                {
                    if (wasSelected.has(tile)) continue;
                    tile.selected = false;
                    continue;
                }

                wasSelected.delete(tile);
                tile.selected = true;
            }
        });
    };

    public get rows():number
    {
        return this._rows;
    }

    public get cols():number
    {
        return this._cols;
    }
    
    public getTileAt(col:number, row:number):InstanceType<TileConstructor<A, D, T>> | undefined
    {
        if (row < 0 || row >= this._rows) return undefined;
        if (col < 0 || col >= this._cols) return undefined;

        const index = row * this._cols + col;
        return this._tiles[index];
    }

    public getTileByData(tileData:D):InstanceType<TileConstructor<A, D, T>> | undefined
    {
        for (let i = this._tiles.length; i--;) 
        {
            const tile = this._tiles[i];
        
            if (tile.data.id === tileData.id) return tile;
        }
    }

    public getRowColumnOfTile(icon:InstanceType<TileConstructor<A, D, T>>):{col:number, row:number}
    {
        let index = Array.prototype.indexOf.call(this._elements.tileContainer.children, icon.element);
        if (index === -1) throw new Error('Tile not found');

        return this.getTileRowColumnByIndex(index);
    }

    public getTileIndex(icon:InstanceType<TileConstructor<A, D, T>>):number
    {
        let index = Array.prototype.indexOf.call(this._elements.tileContainer.children, icon.element);
        if (index === -1) throw new Error('Icon not found');

        return index;
    }

    public getTileRowColumnByIndex(index: number): { row: number, col: number } 
    {
        const row = Math.floor(index / this._cols);
        const col = index % this._cols;
        return { row, col };
    }  

    public get tiles():InstanceType<TileConstructor<A, D, T>>[]
    {
        return this._tiles;
    }

    public getTilePosition(clientX:number, clientY:number, clamp:true):{col:number, row:number};
    public getTilePosition(clientX:number, clientY:number, clamp:false):{col:number, row:number} | undefined;
    public getTilePosition(clientX:number, clientY:number, clamp:boolean):{col:number, row:number} | undefined
    {
        let scaledIconSize = this.#calculateScaledSize(this._tileSize, ICON_SCALING_FACTOR);

        //first get the row and column closest to these x and y coordinates. ensure that the row and column are within the grid
        let gridOffset = this._element.getBoundingClientRect();
        let x = clientX - gridOffset.left;
        let y = clientY - gridOffset.top;

        const iconOffset1 = this._tiles[0].element.getBoundingClientRect(); //row 0, col 0
        const iconOffset2 = this._tiles[this._cols + 1].element.getBoundingClientRect(); //row 1, col 1

        //get the horizontal and vertical spacing between icons
        const horizontalSpacing = iconOffset2.left - iconOffset1.right;
        const verticalSpacing = iconOffset2.top - iconOffset1.bottom;

        //get the total width and height of an icon, including spacing
        const totalIconWidth = scaledIconSize + horizontalSpacing;
        const totalIconHeight = scaledIconSize + verticalSpacing;
        
        let col = Math.floor(x / totalIconWidth);
        let row = Math.floor(y / totalIconHeight);

        if (!clamp)
        {
            if (col < 0 || row < 0) return undefined;
            if (col >= this._cols || row >= this._rows) return undefined;
        }

        col = Math.min(Math.max(col, 0), this._cols - 1);
        row = Math.min(Math.max(row, 0), this._rows - 1);

        return {col:col, row:row};
    }

    public getTileXAndY(col:number, row:number):{x:number, y:number}
    {
        const iconOffset1 = this._tiles[0].element.getBoundingClientRect(); //row 0, col 0
        const iconOffset2 = this._tiles[this._cols + 1].element.getBoundingClientRect(); //row 1, col 1

        //get the horizontal and vertical spacing between icons
        const horizontalSpacing = iconOffset2.left - iconOffset1.right;
        const verticalSpacing = iconOffset2.top - iconOffset1.bottom;

        //get the total width and height of an icon, including spacing
        const totalIconWidth = this._tileSize + horizontalSpacing;
        const totalIconHeight = this._tileSize + verticalSpacing;

        const x = col * totalIconWidth;
        const y = row * totalIconHeight;

        return {x, y};
    }

    public getTileAtCoordinates(clientX:number, clientY:number):InstanceType<TileConstructor<A, D, T>> | undefined
    {
        let position = this.getTilePosition(clientX, clientY, false);
        if (!position) return undefined;

        return this.getTileAt(position.col, position.row);
    }

    public getClosestAvailableTilePositions(clientX:number, clientY:number):Array<{col:number, row:number}>
    {  
        let {col, row} = this.getTilePosition(clientX, clientY, true);
      
        let availablePositions: {col:number, row:number}[] = [];
      
        //fill availablePositions
        for (let i = 0; i < this._rows; i++) 
        {
            for (let j = 0; j < this._cols; j++) 
            {
                if (!this.isTilePositionAvailable(j, i)) continue;
                
                availablePositions.push({col:j, row:i});
            }
        }
      
        //calculate distance and sort
        availablePositions = availablePositions.map(pos => ({row:pos.row, col:pos.col, distance: Math.sqrt(Math.pow(pos.row - row, 2) + Math.pow(pos.col - col, 2))})).sort((a, b) => a.distance - b.distance).map(pos => ({row: pos.row, col: pos.col})); //removing the distance key
      
        return availablePositions;
    }
      
    public getClosestAvailableTilePosition(clientX:number, clientY:number, getUnavailableIfNoneAvailable:true):{col:number, row:number};
    public getClosestAvailableTilePosition(clientX:number, clientY:number, getUnavailableIfNoneAvailable:false):{col:number, row:number} | undefined;
    public getClosestAvailableTilePosition(clientX:number, clientY:number, getUnavailableIfNoneAvailable:boolean):{col:number, row:number} | undefined
    {
        let {col, row} = this.getTilePosition(clientX, clientY, true);

        //get available positions, find the closest one to the given coordinates
        let availablePositions:{col:number, row:number}[] = [];
        for (let i = 0; i < this._rows; i++)
        {
            for (let j = 0; j < this._cols; j++)
            {
                if (this.isTilePositionAvailable(j, i)) availablePositions.push({col:j, row:i});
            }
        }

        if (availablePositions.length)
        {
            let closestPosition = availablePositions.reduce((prev, curr) => 
            {
                let prevDistance = Math.sqrt(Math.pow(prev.row - row, 2) + Math.pow(prev.col - col, 2));
                let currDistance = Math.sqrt(Math.pow(curr.row - row, 2) + Math.pow(curr.col - col, 2));

                return prevDistance < currDistance ? prev : curr;
            });

            return closestPosition;
        }

        if (getUnavailableIfNoneAvailable) return this.getClosestTilePosition(clientX, clientY);

        return undefined;
    }

    public getClosestTilePosition(clientX:number, clientY:number):{col:number, row:number}
    {
        let {col, row} = this.getTilePosition(clientX, clientY, true);

        //no available positions, find the closest position to the given coordinates
        let closestPosition = {row:0, col:0};   
        let closestDistance = Infinity;
        for (let i = 0; i < this._rows; i++)
        {
            for (let j = 0; j < this._cols; j++)
            {
                let distance = Math.sqrt(Math.pow(i - row, 2) + Math.pow(j - col, 2));
                if (distance < closestDistance)
                {
                    closestDistance = distance;
                    closestPosition = {col:j, row:i};
                }
            }
        } 

        return closestPosition;
    }

    /**
     * Checks if an icon at the given position contains content. if it doesn't it is considered available.
     * @param row The row index of the cell to check.
     * @param col The column index of the cell to check.
     * @returns True if the cell is available, false otherwise.
     */
    public isTilePositionAvailable(col:number, row:number):boolean
    {
        let icon = this.getTileAt(col, row);
        if (!icon) return false;

        return !icon.data.info;
    }

    /**
     * Returns the first available position in the grid where an icon does not have any content
     * @returns An object with the row and column of the available position, or undefined if there are no available positions.
     */
    public getFirstAvailableTilePosition():{col:number, row:number} | undefined
    {
        const rows = this._rows;
        const columns = this._cols;

        for (let i = 0; i < rows; i++) 
        {
            for (let j = 0; j < columns; j++) 
            {
                const index = i * columns + j;

                let icon = this.getTileAt(j, i);
                if (!icon)
                {
                    this.warn('Tile not found');
                    continue; //should never happen
                }
                
                if (icon.data.info) continue;

                return {col:j, row:i};
            }
        }

        return undefined;
    }
     
    protected override async onShow(initial:boolean, entry:IntersectionObserverEntry, style:CSSStyleDeclaration):Promise<void>
    {
        this.onResizeListened();
    }

    protected async onResizeListened(event?:Event):Promise<void>
    {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this._element.style.maxWidth = Math.min(width, height) + 'px'; 
        this._element.style.maxHeight = Math.min(width, height) + 'px';

        const iconSizeScaled = this.#calculateScaledSize(this._tileSize, ICON_SCALING_FACTOR);

        const tiles = this._tiles;
        for (const tile of tiles) tile.setSize(iconSizeScaled, iconSizeScaled);
    }

    #calculateScaledSize(baseSize:number, scalingFactor:number) 
    {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        const maxWidth = window.screen.availWidth;
        const maxHeight = window.screen.availHeight;
        
        const widthDifference = maxWidth - width;
        const heightDifference = maxHeight - height;

        const widthPercentage = widthDifference / maxWidth;
        const heightPercentage = heightDifference / maxHeight;

        const scaledWidth = Math.max(baseSize / 3, baseSize * (1 - widthPercentage));
        const scaledHeight = Math.max(baseSize / 3, baseSize * (1 - heightPercentage));
        return Math.min(scaledWidth, scaledHeight) * scalingFactor;
    }
    
    public set selected(tileDatas:Array<D>)
    {
        const tiles = this._tiles;
        for (let i = tiles.length; i--;) 
        {
            const tile = tiles[i];

            if (tile.data.info === undefined) 
            {
                tile.selected = false;
                continue;
            }

            tile.selected = tileDatas.find(tileData => tileData.id === tile.id) !== undefined;
        }
    }
    
    public get selected():Array<D> 
    {
        const tiles = this._tiles;
        const selected:Array<D> = [];
        for (let i = tiles.length; i--;) 
        {
            const tile = tiles[i];
            if (tile.selected) selected.push(tile.data);
        }
        
        return selected;
    }
    
    public createDragImage(draggable:IDraggable, event:DragEvent):void
    {
        let selected = this.selected;

        if (!selected.length) throw new Error('No selected tiles');

        const clone = this._app.domUtil.clone(this._element);
        clone.setAttribute('data-treeview', '{"skip":"true"}'); //so this node does not show up in the Tree View component
        clone.style.position = 'absolute';
        clone.style.left = '0px';
        clone.style.top = '0px';
        document.body.appendChild(clone);

        const cloneRect = clone.getBoundingClientRect();
        clone.style.left = `-${cloneRect.width * 1.25}px`; //set the left and top to the negative width and height of the clone element, multiplied by 1.25 to ensure the clone is not visible (including any borders)
        clone.style.top = `-${cloneRect.height * 1.25}px`; //set the left and top to the negative width and height of the clone element, multiplied by 1.25 to ensure the clone is not visible (including any borders)

        //hide any tile that is not selected
        const tiles = this._tiles;
        for (let i = tiles.length; i--;)
        {
            const tile = tiles[i];
            if (tile.selected === false && tile.data.info) 
            {
                const id = tile.id;

                if (id === '') throw new Error('Tile id is empty');

                //get the clone element with the same id and set its opacity to 0
                const cloneTile = this._app.componentUtil.get<HTMLElement>(id, clone);
                if (cloneTile !== undefined) cloneTile.style.opacity = '0';
                else throw new Error('Clone tile not found');
            }
        }

        //calculate the mouse position relative to this._elements
        const rect = this._element.getBoundingClientRect();
        const relativeX = event.clientX - rect.left;
        const relativeY = event.clientY - rect.top;
        
        event.dataTransfer!.setDragImage(clone, relativeX, relativeY);

        //remove clone
        window.setTimeout(() => clone.remove(), 0); 
    }

    public setDragData(draggable:IDraggable, event:DragEvent):void
    {
        //create url for a possible file download
        const blob = new Blob([ISSUE_TEXT], {type:"text/plain"});

        if (this._url !== undefined) URL.revokeObjectURL(this._url);
        this._url = URL.createObjectURL(blob);

        event.dataTransfer!.setData('DownloadURL', 'text/plain:readme.txt:' + this._url);
    }

    public clearDragData(): void
    {
        if (this._url !== undefined) URL.revokeObjectURL(this._url);
    }

    public onDrop(draggable:IDraggable | undefined, toDraggable:IDraggable | undefined, event:DragEvent):void
    {
        this.onDropSignal.dispatch(this, draggable, toDraggable, event);
    }

    public showGridOutline()
    {
        for (let i = this._tiles.length; i--;) this._tiles[i].showOutline();
    }

    public get tileTemplateHTML():string { return this._tileTemplateHTML ?? (this._tileTemplateHTML = this._elements.tileTemplate.innerHTML); }

    public override get requiresManualInitialization():boolean { return true; } //require manual init. will require additional work to allow this component to be initialized via HTML (probably not worth the effort)

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}