/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */
	
import type { ITileData } from "./ITileData";
import { IBoardType } from "./IBoard";
import { Component } from "../Component";
import type { IBaseApp } from "../../IBaseApp";
import { ComponentDecorator } from "../../decorators/ComponentDecorator";
import type { IBoard } from "./IBoard";
import type { ITile } from "./ITile";
import { ITileableType } from "./ITileable";
import type { TileConstructor } from "./IBoard";
import type { ISignal } from "../../../../../../../shared/src/library/signal/ISignal";
import { Signal } from "../../../../../../../shared/src/library/signal/Signal";
import { IDraggableTargetType } from "../IDraggableTarget";
import type { IDraggable } from "../IDraggable";
import type { IDraggableTarget } from "../IDraggableTarget";
import { EventListenerAssistant } from "../../assistants/EventListenerAssistant";
import { DebounceAssistant } from "../../assistants/DebounceAssistant";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { SignalAssistant } from "../../assistants/SignalAssistant";
import { IntervalAssistant } from "../../assistants/IntervalAssistant";
import type { ICollection } from "../../../../../../../shared/src/library/collection/ICollection";
import { ImplementsDecorator } from "../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../../shared/src/library/error/IError";

@ComponentDecorator()
@ImplementsDecorator(IBoardType, ITileableType, IDraggableTargetType)
export abstract class Board<A extends IBaseApp<A>, D extends ITileData, T extends ITile<A, D>> extends Component<A> implements IBoard<A, D, T> 
{
    public getTile!:(data:D, getFromPool:(tileConstructor:TileConstructor<A, D, T>) => InstanceType<TileConstructor<A, D, T>>| undefined) => [InstanceType<TileConstructor<A, D, T>>, Promise<void>];
    public onTileRenewed!:(tile:InstanceType<TileConstructor<A, D, T>>) => void; //function to renew a tile
    public onTileReturned!:(tile:InstanceType<TileConstructor<A, D, T>>) => void; //function to dispose of a tile
    
    private readonly _tilePool:Map<TileConstructor<A, D, T>, Array<InstanceType<TileConstructor<A, D, T>>>> = new Map<new (...args:any[]) => InstanceType<TileConstructor<A, D, T>>, Array<InstanceType<TileConstructor<A, D, T>>>>(); //pool of tiles for reuse

    public readonly onDropSignal:ISignal<[IDraggableTarget, draggable:IDraggable | undefined, toDraggable:IDraggable | undefined, dragEvent:DragEvent]> = new Signal(this);

    protected _eventListenerAssistant!:EventListenerAssistant<A>;
    protected _signalAssistant!:SignalAssistant<A>;

    private _intervalAssistant!:IntervalAssistant<A>;

    protected _dataProvider?:ICollection<A, D>; //data for each tile

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, html?:string) 
    {
        super(app, destructor, element, html);

        this._eventListenerAssistant = new EventListenerAssistant(app, this);
        this._signalAssistant = new SignalAssistant(app, this);

        this._destructablesSizeLimit = Number.MAX_SAFE_INTEGER; //we don't have a limit on the number of destructables
    }

    public override async init(...args:any):Promise<void>
    {
        const app = this._app;

        this._intervalAssistant = new IntervalAssistant(app, this);

        this._eventListenerAssistant.subscribe(this._element, 'drop', (event:DragEvent) => 
        {
            event.stopImmediatePropagation();

            app.dragAndDropManager.onDragTargetDropped(this, event);
        });

        return super.init(...args);
    }

    public abstract setDataProvider(dataProvider:ICollection<A, D> | undefined):Promise<void>;

    public get dataProvider():ICollection<A, D> | undefined
    {
        return this._dataProvider;
    }
    
    public abstract get selected():Array<D>;
    public abstract set selected(val:Array<D>);

    public abstract createDragImage(draggable:IDraggable,event:DragEvent):void;
    public abstract setDragData(draggable:IDraggable, event:DragEvent):void;
    public abstract clearDragData():void;

    public onDrop(draggable:IDraggable | undefined, toDraggable:IDraggable | undefined, event:DragEvent):void
    {
        this.onDropSignal.dispatch(this, draggable, toDraggable, event);
    }

    protected getTileFromPool = (data:D, abortable:IAbortable):[InstanceType<TileConstructor<A, D, T>>, Promise<void>] =>
    {
        const tilePool = this._tilePool;
        
        return this.getTile(data, (tileConstructor:TileConstructor<A, D, T>):InstanceType<TileConstructor<A, D, T>> | undefined => 
        {
            if (!tilePool.has(tileConstructor)) return undefined;
            
            const pool = tilePool.get(tileConstructor)!;
            if (pool.length === 0) return undefined;

            const tile = pool.pop()!;
            tile.element.style.display = 'block';

            return tile;
        });
    }

    protected returnTileToPool = (tile:InstanceType<TileConstructor<A, D, T>>):void =>
    {
        const tilePool = this._tilePool;

        tile.element.style.display = 'none';
        
        this.onTileReturned(tile);

        //add to pool for reuse
        if (tilePool.has(tile.constructor as TileConstructor<A, D, T>)) tilePool.get(tile.constructor as TileConstructor<A, D, T>)!.push(tile);
        else tilePool.set(tile.constructor as TileConstructor<A, D, T>, [tile]);
    }

    private readonly _tilesAwaitingDnit:Array<ITile<A, D>> = []; //pool tiles awaiting to be dnited and removed from the DOM

    private _cleanup = new DebounceAssistant(this, async (abortable:IAbortable):Promise<void | IAborted | IError> => 
    {
        try
        {
            const _ = this.createAbortableHelper(abortable).throwIfAborted();

            const tilesAwaitingDnit = this._tilesAwaitingDnit;

            const elementsToBeRemoved:HTMLElement[] = new Array(tilesAwaitingDnit.length); //elements that will be removed from the DOM
            const promises = new Array(tilesAwaitingDnit.length);
            for (let i = tilesAwaitingDnit.length; i--;)
            {
                const tile = tilesAwaitingDnit[i];

                elementsToBeRemoved[i] = tile.element;
                promises[i] = tile.dnit(false);
            }
            tilesAwaitingDnit.length = 0;

            _.values(await Promise.all(promises));

            _.check(await this._app.promiseUtil.nextAnimationFrame());

            for (const element of elementsToBeRemoved) element.remove();
        }
        catch (error)
        {
            return this._app.warn(error, 'Error occurred while cleaning up tiles.', [], {names:[Board, '_cleanup']});
        }
    }, {throttle:300, delay:300, id:'_cleanup'});

    protected cleanupPool = () =>
    {
        if (this._intervalAssistant.isRunning) return;

        const innerCleanupPool = () => //ensures the pool is eventually drained
        {
            if (this.dnited !== false) return; 
            
            const tilePool = this._tilePool;
            const tilesAwaitingDnit = this._tilesAwaitingDnit;
            const maxTilesPerPool = 1000; //limit the number of tiles we keep in the pool to 1000 (creating and destroying tiles is expensive, so we want to keep as many as possible in the pool)
            const minTilesToKeepInPool = 25; //keep at least 25 tiles of each type in the pool
            let totalRemoved = 0;
    
            let maxTilesToRemovePerCleanup = 3; //this can cause a singificant performance hit, so we limit it to 3 per timeout (really to ensure the pool eventually drains)
            
            for (const [_key, pool] of tilePool) 
            {
                if (pool.length > maxTilesPerPool) maxTilesToRemovePerCleanup = pool.length - Math.floor(maxTilesPerPool / 2); //if we have more than 1000 tiles in the pool, reduce the pool count to 500

                let removed = 0;
                const tilesAwaitingDnitLength = tilesAwaitingDnit.length;
                for (let i = pool.length; i--;)
                {
                    if (totalRemoved >= maxTilesToRemovePerCleanup) break; //limit the number of tiles we remove per timeout
                    if (pool.length < minTilesToKeepInPool) break; //keep at least x tiles of each type in the pool

                    const tile = pool[i];
                   
                    tilesAwaitingDnit[tilesAwaitingDnitLength + removed] = tile; //add to tiles to be dnited

                    removed++;
                    totalRemoved++;
                }

                pool.length -= removed;
            }

            this._cleanup.execute(); //dnit/removal is expensive, so we will do it in bulk every Xms

            if (totalRemoved < maxTilesToRemovePerCleanup) this._intervalAssistant.stop(); //we are done, so stop the interval
        }

        this._intervalAssistant.start(innerCleanupPool, 33.33, false); //cleanup in 33.33ms
    }

    protected async clearTilePool():Promise<void>
    {
        const tilePool = this._tilePool;
        const promises = [];
        for (const [key, pool] of tilePool) 
        {
            for (let i = pool.length; i--;) promises.push(pool[i].dnit(false));
            pool.length = 0;
        }
        await Promise.all(promises);
    }
}