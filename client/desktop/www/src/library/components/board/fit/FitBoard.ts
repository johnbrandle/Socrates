/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */
	
import type { ITile } from "../ITile";
import { VScrollBar } from "../../scrollbar/VScrollBar";
import type { ITileData } from "../ITileData";
import type { IBaseApp } from "../../../IBaseApp";
import { ComponentDecorator } from "../../../decorators/ComponentDecorator";
import type { IFitBoard } from "./IFitBoard";
import { IFitBoardType } from "./IFitBoard";
import { Board } from "../Board";
import html from "./FitBoard.html";
import { DebounceAssistant } from "../../../assistants/DebounceAssistant";
import type { TileConstructor } from "../IBoard";
import type { IDraggable } from "../../IDraggable";
import type { IDestructor } from "../../../../../../../../shared/src/library/IDestructor";
import type { ICollection } from "../../../../../../../../shared/src/library/collection/ICollection";
import { ImplementsDecorator } from "../../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import type { IAbortable } from "../../../../../../../../shared/src/library/abort/IAbortable";
import type { IError } from "../../../../../../../../shared/src/library/error/IError";
import type { IAborted } from "../../../../../../../../shared/src/library/abort/IAborted";
import { AbortController } from "../../../../../../../../shared/src/library/abort/AbortController";

export class FitboardElements
{
    container!:HTMLElement;
    vScrollbar!:HTMLElement;
}

@ComponentDecorator()
@ImplementsDecorator(IFitBoardType)
export abstract class FitBoard<A extends IBaseApp<A>, D extends ITileData, T extends ITile<A, D>> extends Board<A, D, T> implements IFitBoard<A, D, T> 
{
    private _width!:number; //width of grid
    private _height!:number; //height of grid
    private _previousHeight = 0; //so we can calculate the previous maxScrollPosition when the height changes, as we use this to calculate a new relative position for yOffset (scrollbar scrollPosition)
    private _virtualHeight = 0;  //height of grid if all tiles were showing (not clipped)

    private _targetTileWidth!:number;  //preferred unsized tile value
    private _targetTileHeight!:number;  //preferred unsized tile value
    
    private _minimumTileWidth!:number;
    private _maximumTileWidth!:number;
    
    private _sizedTileWidth = 0;  //sized to fit value
    private _sizedTileHeight = 0;  //sized to fit value
    
    protected _visibleTileStartIndex = 0; //index of first visible tile
    protected _visibleTiles = 0; //number of visible tiles
    protected _tileYOffset = 0; //amount of visible tile overhang... over the top. this is related to _visibleTileStartIndex, is the offset of the first visible tile row, as it may not be fully visible

    private _scrollPosition = 0; //amount of grid upward overhang, min value of 0, max value of (virtualHeight - height)

    private _tiles:Record<string, T> = {}; //visible tiles, key is tile id, value is tile

    private _columns = 0; //number of tile columns
    private _rows = 0; //number of tile rows
    
    private _vScrollBar!:VScrollBar<A>; //scrollbar
    
    private _spacing:[number, number] = [5, 5]; //spacing between tiles

    protected _padding:[number, number, number, number] = [10, 10, 10, 10]; //top, right, bottom, left

    private _singleColumnMode:boolean = false;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init(singleColumnMode:true, targetTileHeight:number, minimumWidth:number, maximumWidth?:number, getTile?:(data:D, getFromPool:(tileConstructor:TileConstructor<A, D, T>) => InstanceType<TileConstructor<A, D, T>> | undefined) => [InstanceType<TileConstructor<A, D, T>>, Promise<void>], onTileRenewed?:(tile:InstanceType<TileConstructor<A, D, T>>) => void, onTileReturned?:(tile:InstanceType<TileConstructor<A, D, T>>) => void):Promise<void>;
    public override async init(targetTileWidth:number, targetTileHeight:number, minimumScaleRatio:number, maximumScaleRatio:number, getTile?:(data:D, getFromPool:(tileConstructor:TileConstructor<A, D, T>) => InstanceType<TileConstructor<A, D, T>> | undefined) => [InstanceType<TileConstructor<A, D, T>>, Promise<void>], onTileRenewed?:(tile:InstanceType<TileConstructor<A, D, T>>) => void, onTileReturned?:(tile:InstanceType<TileConstructor<A, D, T>>) => void):Promise<void>;
    public override async init(...args:any[]):Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._width = this._element.offsetWidth; //set width to desired width
        this._height = this._previousHeight = this._element.offsetHeight; //set height to desired height
     
        if (args[0] === true)
        {
            const [singleColumnMode, targetTileHeight, minimumWidth, maximumWidth, getTile, onTileRenewed, onTileReturned] = args;

            this._singleColumnMode = singleColumnMode;
            this._targetTileWidth = 0;
            this._targetTileHeight = targetTileHeight; //set target tile height

            this._minimumTileWidth = minimumWidth;
            this._maximumTileWidth = maximumWidth ?? Number.MAX_SAFE_INTEGER;

            this.getTile = getTile ?? this.getTile;
            this.onTileReturned = onTileReturned ?? this.onTileReturned;
            this.onTileRenewed = onTileRenewed ?? this.onTileRenewed;
        }
        else
        {
            const [targetTileWidth, targetTileHeight, minimumScaleRatio, maximumScaleRatio, getTile, onTileRenewed, onTileReturned] = args;

            this._targetTileWidth = targetTileWidth; //set target tile width
            this._targetTileHeight = targetTileHeight; //set target tile height

            this._minimumTileWidth = this._targetTileWidth * minimumScaleRatio; //x% smaller than target tile width
            this._maximumTileWidth = this._targetTileWidth * maximumScaleRatio; //x% larger than target tile width (only relevant when there is only a single column or row showing)
        
            this.getTile = getTile ?? this.getTile;
            this.onTileReturned = onTileReturned ?? this.onTileReturned;
            this.onTileRenewed = onTileRenewed ?? this.onTileRenewed;
        }
        
        //setup vertical scrollbar
        this._vScrollBar = elements.vScrollbar.component as VScrollBar<A>;
        this._signalAssistant.subscribe(this._vScrollBar.onScrollSignal, this.onScrolled);

        //the following code is trying to account for erratic deltaY values in the WheelEvent. (probably due to my mouse's scroll wheel being a bit wonky)
        //when scrolling in a specific direction very rapidly, every once in a while a scroll event will be fired in the opposite direction.
        //this code attempts to detect these erroneous events and invert the deltaY value to counteract the erroneous jump.
        //this helps in maintaining a consistent scroll direction even if the event data is incorrect.
        //
        //initialize a variable to track the last scroll direction.
        //it will be 0 initially, indicating no previous direction.
        //it will be set to 1 for a downward scroll, and -1 for an upward scroll.
        let lastDirection = 0;

        //subscribe to the 'wheel' event on the specified element.
        //the 'passive' option is set to true for performance improvements in modern browsers.
        this._eventListenerAssistant.subscribe(this._element, 'wheel', (event: WheelEvent) =>
        {
            //if there is no last known direction (i.e., this is the first event or after a reset),
            //determine the direction of this scroll event and set it as the last direction.
            if (lastDirection === 0) lastDirection = event.deltaY > 0 ? 1 : -1;
            
            //store the deltaY value from the event. This represents the scroll amount and direction.
            let deltaY = event.deltaY;

            //determine the direction of the current scroll event: 1 for down, -1 for up.
            let thisDirection = event.deltaY > 0 ? 1 : -1;

            //check if the current scroll direction is different from the last known direction.
            if (thisDirection !== lastDirection) 
            {
                //if the direction changed, invert deltaY to counteract the erroneous jump.
                //this helps in maintaining a consistent scroll direction even if the event data is incorrect.
                deltaY = -deltaY;

                //reset the last direction to 0, indicating that a direction change has occurred.
                //this is necessary to allow for future genuine changes in scroll direction.
                lastDirection = 0;
            }

            //call the onScrolled method with the (potentially adjusted) deltaY.
            //this method handles the actual scrolling logic.
            this.onScrolled(this._vScrollBar, deltaY);
        }, {passive:true});

        return super.init();
    }

    public override async setDataProvider(dataProvider:ICollection<A, D> | undefined, ...args:any[]):Promise<void>
    {
        if (this._dataProvider === dataProvider) return;
        if (this._dataProvider !== undefined) this._signalAssistant.unsubscribe(this._dataProvider.onInvalidatedSignal);
        
        this._dataProvider = dataProvider;

        if (dataProvider === undefined) return;
        
        this._signalAssistant.subscribe(dataProvider.onInvalidatedSignal, (_dataProvider:ICollection<A, D>) => { this._redraw.execute(); });

        return this._redraw.execute(true);
    }
    
    private onScrolled = (_scrollbar:VScrollBar<A>, delta:number, _direction?:string):void =>
    {
        const minScrollPosition = 0;
        const maxScrollPosition = Math.max((this._virtualHeight - this._height), 0);

        this._scrollPosition += delta;
        if (this._scrollPosition < minScrollPosition) this._scrollPosition = minScrollPosition;
        if (this._scrollPosition > maxScrollPosition) this._scrollPosition = maxScrollPosition;

        if (this._dataProvider !== undefined) this._redraw.execute();
    }
     
    public override async onResize(_initial:boolean, _entry:ResizeObserverEntry):Promise<void>
    {   
        const width = this._element.offsetWidth;
        const height = this._element.offsetHeight;

        if (width === 0 && height === 0) return; //if width and height is 0, return
        
        this._previousHeight = this._height;
        this._width = width;
        this._height = height;

        if (this._dataProvider !== undefined) this._redraw.execute();
    }
    
    private _redraw = new DebounceAssistant<A, [boolean | void]>(this, async (abortable:IAbortable, clearExistingTiles:boolean | void=false):Promise<void | IAborted | IError> => //async action assistant will ensure this function is only called one at a time, and will ensure it is called again after if it is invalidated
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = abortController.abortableHelper.throwIfAborted();

            if (this.initialized !== true) this._app.throw('_redraw called before fitboard initialized', [], {correctable:true});

            const dataProvider = this._dataProvider;
            if (dataProvider === undefined) return abortController.abort('no data provider');
            
            const singleColumnMode = this._singleColumnMode;
            const ySpacing = this._spacing[1];
            const xSpacing = singleColumnMode ? 0 : this._spacing[0];
            const height = this._height;
            const [paddingTop, paddingRight, paddingBottom, paddingLeft] = this._padding; //[top, right, bottom, left]

            /**
             * Calculates the layout of a grid of tiles that shrink and grow to fit the grid size.
             * Spacing is only between tiles, not alongside the edges of the grid.
             * The grid can be scrolled vertically, and spacing between tiles is fixed.
             *
             * As the grid increases in width:
             * - Tiles grow to accommodate added space.
             * - If tiles can be x% smaller than their target size and allow for an additional column, a column is added, and tiles are resized.
             *
             * As the grid decreases in width:
             * - Tiles shrink to accommodate removed space.
             * - If tiles would shrink below x% of their target size, a column is removed, and tiles are enlarged to fit.
             */
            const calc = ():boolean => 
            { 
                //the width minus the scrollbar width
                const availableWidth = this._width - this._vScrollBar.width - (paddingLeft + paddingRight); 
        
                const targetTileHeight = this._targetTileHeight;
                const targetTileWidth = singleColumnMode ? availableWidth : this._targetTileWidth;
                const minimumTileWidth = this._minimumTileWidth;
                const maximumTileWidth = this._maximumTileWidth;

                if (targetTileWidth < minimumTileWidth) return false;

                const calculateColumnsRowsAndSizedTileWidthHeight = ():[number, number, number, number] =>
                {
                    //available width minus spacing between tiles, divided by number of columns, gives actual tile width
                    const calculateScaledTileWidth = (columns:number):number => (availableWidth - ((columns - 1) * xSpacing)) / columns; 
        
                    //max amount of columns, takes into account spacing, and rounds up. why? because this gives the icons a chance to enlarge to fit the grid width
                    let columns = Math.ceil(availableWidth / (targetTileWidth + xSpacing)) || 1;
                    
                    //available width minus spacing between tiles, divided by number of columns, gives actual tile width
                    let sizedTileWidth = calculateScaledTileWidth(columns); 
                    
                    //don't let tile get too small, if scaled tile width is 10% smaller than target tile width, remove a column, and recaculate scaled tile width. keep doing this till it fits
                    while (sizedTileWidth <= minimumTileWidth) 
                    {
                        //if we only have one column, we can't remove any more columns, so break
                        if (columns === 1) break; 
                        
                        columns--;
                        sizedTileWidth = calculateScaledTileWidth(columns);
                    }
        
                    //don't let the tile get too big, but it should be able to grow a bit.
                    if (columns === 1) sizedTileWidth = Math.min(sizedTileWidth, maximumTileWidth); 
                    
                    //check if we only have a single row of tiles
                    if (columns > dataProvider.size) //example: if we have 10 tiles, and 1000 columns, we can't have more than one row, because we only have 10 tiles
                    {
                        //set columns to number of tiles
                        columns = dataProvider.size || 1; 
                        sizedTileWidth = calculateScaledTileWidth(columns);
                        
                        //don't let the tile get too big, but it should be able to grow a bit.
                        if (sizedTileWidth > targetTileWidth) sizedTileWidth = Math.min(sizedTileWidth, maximumTileWidth); 
                    }
        
                    //calc rows based on columns and number of tiles, number of tiles divided by number of columns, rounded up, gives number of rows
                    const rows = Math.ceil(dataProvider.size / columns) || 1; //columns could be 0, which would result in NaN so we use || 0 to ensure it's a number
        
                    //ratio of target tile width to target tile height
                    const ratio = targetTileHeight / targetTileWidth;
        
                    //scaled tile width times ratio, gives scaled tile height 
                    const sizedTileHeight = (sizedTileWidth * ratio); 
        
                    return [columns, rows, sizedTileWidth, sizedTileHeight];
                }
                    
                const [columns, rows, sizedTileWidth, sizedTileHeight] = calculateColumnsRowsAndSizedTileWidthHeight();
        
                if (sizedTileWidth < minimumTileWidth) return false;

                this._columns = columns; //set columns
                this._rows = rows; //set rows
                this._sizedTileWidth = sizedTileWidth; //set sized tile width
                this._sizedTileHeight = sizedTileHeight; //set sized tile height
                let scrollPosition = this._scrollPosition;

                //calculate the previous maxScrollPosition (this is used later to adjust scrollPosition so the scrollbar thumb stays in the same relative position when the grid height changes)
                const prevMaxScrollPosition = Math.max((this._virtualHeight - this._previousHeight), 0);
                this._previousHeight = height; //set previous height to current height
                const offsetRatio = (this._scrollPosition / prevMaxScrollPosition) || 0;

                //calc tile window height virtual, number of rows times scaled tile height plus spacing between tiles, minus spacing between tiles, gives virtual height
                this._virtualHeight = ((rows * (sizedTileHeight + ySpacing)) - ySpacing) + (paddingTop + paddingBottom); 

                //calculate new maxScrollPosition
                const maxScrollPosition = Math.max((this._virtualHeight - height), 0);

                //update scrollPosition based on the change in maxScrollPosition (this ensures the scrollbar thumb stays in the same relative position when the grid height changes)
                if (!isNaN(offsetRatio) && prevMaxScrollPosition !== maxScrollPosition) scrollPosition = offsetRatio * maxScrollPosition;
                
                //clamp scrollPosition to the minScrollPosition (zero) and new maxScrollPosition
                if (this._virtualHeight <= height) scrollPosition = 0; 
                else scrollPosition = Math.max(0, Math.min(scrollPosition, this._virtualHeight - height)); 
                this._scrollPosition = scrollPosition; //set scroll position

                //calc tile start index, index. this is just the offset of the first visible tile, it does not take into account how much of the tile is visible (which is what _tileYOffset is for)
                if (scrollPosition <= paddingTop)
                {
                    this._visibleTileStartIndex = 0;
                    this._tileYOffset = (-scrollPosition + paddingTop);
                }
                else
                {
                    if (scrollPosition - paddingTop >= sizedTileHeight + ySpacing)
                    {
                        //calculate the row by dividing scrollPosition by the combined height of a tile and its spacing. This gives the row number of the first visible tile
                        const row = (Math.floor((scrollPosition - paddingTop) / (sizedTileHeight + ySpacing)) || 0);
            
                        //multiply by columns to get the starting index for the visible tiles. This gives the index of the first visible tile
                        this._visibleTileStartIndex = row * columns;
                    }
                    else this._visibleTileStartIndex = 0;
                    
                    //relative to visibleTileStartIndex (the first visible tile row), as it may not be fully visible
                    this._tileYOffset = ((-scrollPosition) + paddingTop) % (sizedTileHeight + ySpacing); //calc tile y offset, this is the amount of the first visible tile that is not visible (it's 0 or a negative value which should be less than sizedTileHeight)
                }
                
                //calculates the number of visible tiles within the container.
                //1. Subtracts the vertical tile offset from the container height to get the available height for tiles.
                //2. Divides that available height by the total height of a single row (including spacing).
                //3. Rounds up to include any partially visible row.
                //4. Multiplies by the number of columns to account for all tiles in visible rows.
                //5. Ensures that the number of visible tiles does not exceed the total number of tiles in the data, minus the tile start index.
                this._visibleTiles = Math.min(Math.ceil((height - this._tileYOffset) / (sizedTileHeight + ySpacing)) * columns, dataProvider.size - this._visibleTileStartIndex) || 0; //or 0 to ensure it's a number
            
                return true;
            }

            const success = calc();
            if (success !== true) return abortController.abort('invalid calculated size');

            let tiles = this._tiles;
            const columns = this._columns;
            const sizedTileHeight = this._sizedTileHeight;
            const sizedTileWidth = this._sizedTileWidth;
            const width = this._width;
            const tileYOffset = this._tileYOffset;
            const visibleTileStartIndex = this._visibleTileStartIndex;
            const displayObjectContainer = this._elements.container;
            const visibleTiles = this._visibleTiles;

            this.debug?.info('columns', `${columns}`);
            this.debug?.info('rows', `${this._rows}`);
            this.debug?.info('sizedTileWidth', `${sizedTileWidth}`);
            this.debug?.info('sizedTileHeight', `${sizedTileHeight}`);
            this.debug?.info('tileYOffset', `${tileYOffset}`);
            this.debug?.info('visibleTileStartIndex', `${visibleTileStartIndex}`);
            this.debug?.info('visibleTiles', `${visibleTiles}`);

            const visibleTileDatas = [];
            for (const tileData of dataProvider.values(visibleTileStartIndex, visibleTileStartIndex + visibleTiles)) visibleTileDatas.push(tileData);

            const visibleTileLookup = new Map<string, D>();
            for (let i = visibleTileDatas.length; i--;) visibleTileLookup.set(visibleTileDatas[i].id, visibleTileDatas[i]);
            
            const newTiles:Record<string, T> = {};
            for (const key in tiles) 
            {
                if (clearExistingTiles === false && visibleTileLookup.has(key)) continue; //tile is still visible, so don't remove

                this.returnTileToPool(tiles[key]); //add to pool for reuse
            }
            if (clearExistingTiles === true) tiles = {}; //clear tiles (we just returned them all to the pool in the previous step)

            const fragment = document.createDocumentFragment();

            const promises:Promise<any>[] = [];
            let column = 0;
            let row = 0;
            for (let i = 0, length = visibleTileDatas.length; i < length; i++)
            {
                const data = visibleTileDatas[i];

                const x = Math.round((column * (sizedTileWidth + xSpacing)) + paddingLeft);
                const y = Math.round((row * (sizedTileHeight + ySpacing)) + tileYOffset);

                let promise:Promise<void>;
                let tile = tiles[data.id];
                if (tile === undefined) 
                {
                    [tile, promise] = this.getTileFromPool(data, abortController);            
                    tiles[data.id] = tile;

                    if (!tile.element.parentElement) fragment.append(tile.element);
                }
                else 
                {
                    if (tile.data.invalidated === true) promise = tile.renew(data, abortController);
                    else promise = Promise.resolve();
                }
                promises.push(promise);
                
                newTiles[data.id] = tile;

                promise.then(async () =>
                {
                    tile.setPosition(x, y);
                    tile.setSize(sizedTileWidth, sizedTileHeight);
                });
                
                column++;
                if (column >= columns) 
                {
                    column = 0;
                    row++;
                }
            }
            this._tiles = newTiles;

            displayObjectContainer.appendChild(fragment);

            this.scrollRect = {x:0, y:0, width:width, height:height};
            
            //update scrollbar. yOffset is scrollPosition (grid controls the scrollbar's scrollPosition). scrollbar thumb positioning is determined by height, minScrollPosition, maxScrollPosition, and scrollPosition
            const minScrollPosition = 0;
            const maxScrollPosition = Math.max((this._virtualHeight - height), 0);
            if (this._scrollPosition < minScrollPosition) this._app.throw('scrollPosition should not be less than minScrollPosition', [], {correctable:true});
            if (this._scrollPosition > maxScrollPosition) this._app.throw('scrollPosition should not be greater than maxScrollPosition', [], {correctable:true});
            
            this.debug?.info('scrollPosition', `${this._scrollPosition} minScrollPosition:${minScrollPosition} maxScrollPosition:${maxScrollPosition}`);

            this._vScrollBar.setScrollProperties(height, this._scrollPosition, minScrollPosition, maxScrollPosition);
            this._vScrollBar.element.style.left = (width - this._vScrollBar.width) + 'px';

            this.cleanupPool(); //cleanup unused tiles

            _.values(await Promise.all(promises)); //waiting after everything this way we don't have to worry about data changing when we are doing calculations which could cause issues
        
            this.onRedraw();
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to redraw', [], {names:[FitBoard, '_redraw']});
        }
    }, {throttle:true, delay:true, id:'_redraw', debug:false});

    protected onRedraw():void {} //optionally override this method to perform additional actions when the grid is redrawn

    /*
    public set selected(tileDatas:Array<T>)
    {
        for (let i = tileDatas.length; i--;) 
        {
            tileDatas[i].selected = true;

            const tile = this._tiles[tileDatas[i].id];
            if (tile) tile.selected = true;
        }
    }
    
    public get selected():Array<T> 
    {
        const datas = this._tileDatas;
        const selected:Array<T> = [];
        for (let i = datas.length; i--;) 
        {
            const tileData = datas[i];
            if (tileData.selected) selected.push(tileData as T);
        }
        
        return selected;
    }
    */

    public set spacing([x, y]:[number, number])
    {
        this._spacing = [x, y];

        if (this._dataProvider !== undefined) this._redraw.execute();
    }

    public set padding([top, right, bottom, left]:[number, number, number, number])
    {
        this._padding = [top, right, bottom, left];

        if (this._dataProvider !== undefined) this._redraw.execute();
    }

    public set tileSize([width, height]:[number, number])
    {
        this._targetTileWidth = width;
        this._targetTileHeight = height;

        if (this._dataProvider !== undefined) this._redraw.execute();
    }
    
    public set tileHeight(val:number)
    {
        this._targetTileHeight = val;

        if (this._dataProvider !== undefined) this._redraw.execute();
    }

    public get tileHeight():number { return this._targetTileHeight; }

    public createDragImage(draggable:IDraggable, event:DragEvent):void
    {
        const selected = this.selected;

        if (!selected.length) this._app.throw('No selected tiles', []);

        const clone = this._app.domUtil.clone(this._element);
        clone.setAttribute('data-treeview', '{"skip":"true"}'); //so this node does not show up in the Tree View component
        clone.style.position = 'absolute';
        clone.style.left = '0px';
        clone.style.top = '0px';
        document.body.appendChild(clone);

        //get element with name vScrollbar and set its display to none
        const clonedVScrollbar = (clone.querySelector('[name="vScrollbar"]') ?? undefined) as HTMLElement | undefined;
        if (clonedVScrollbar !== undefined) clonedVScrollbar.style.display = 'none';

        const cloneRect = clone.getBoundingClientRect();
        clone.style.left = `-${cloneRect.width * 1.25}px`; //set the left and top to the negative width and height of the clone element, multiplied by 1.25 to ensure the clone is not visible (including any borders)
        clone.style.top = `-${cloneRect.height * 1.25}px`; //set the left and top to the negative width and height of the clone element, multiplied by 1.25 to ensure the clone is not visible (including any borders)

        //hide any tile that is not selected
        const tiles = this._tiles;
        const componentUtil = this._app.componentUtil;
        for (const key in tiles) 
        {
            const tile = tiles[key];
            if (!tile.selected && tile.data) 
            {
                const id = tile.id

                if (id === '') this._app.throw('Tile id is empty', []);

                //get the clone element with the same id and set its opacity to 0
                const cloneTile = componentUtil.get<HTMLElement>(id, clone);
                if (cloneTile !== undefined) cloneTile.style.opacity = '0';
                else this._app.throw('Clone tile not found', []);
            }
        }

        //calculate the mouse position relative to this._element
        const rect = this._element.getBoundingClientRect();
        const relativeX = event.clientX - rect.left;
        const relativeY = event.clientY - rect.top;
        
        event.dataTransfer!.setDragImage(clone, relativeX, relativeY);

        //remove clone
        window.setTimeout(() => clone.remove(), 0); 
    }

    public abstract setDragData(draggable:IDraggable, event:DragEvent):void;
    public abstract override clearDragData():void;

    public getTileByData(tileData:D):T | undefined
    {
        for (const key in this._tiles) 
        {
            const tile = this._tiles[key];
            if (tile.data?.id === tileData.id) return tile;
        }
    }

    public set selected(tileDatas:Array<D>)
    {
        for (let i = tileDatas.length; i--;) 
        {
            let tileData = tileDatas[i];
            
            tileData.selected = true;

            const tile = this.getTileByData(tileData);
            if (tile !== undefined) tile.selected = true;
        }
    }
    
    public get selected():Array<D> 
    {
        const tileDatas = this._dataProvider;
        if (tileDatas === undefined) return [];

        const selected:Array<D> = [];
        for (const tileData of tileDatas) if (tileData.selected) selected.push(tileData);
        
        return selected;
    }

    protected override get _elements():FitboardElements { return this.__elements ?? (this.__elements = new FitboardElements()); }

    public override get requiresManualInitialization():boolean { return true; } //require manual init. will require additional work to allow this component to be initialized via HTML (probably not worth the effort). perhaps better to extend this class and override this method to return false
}