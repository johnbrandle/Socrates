/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IError } from "../../error/IError";
import { IBaseApp } from "../../IBaseApp";
import type { IStorage } from "../IStorage";
import { RestoreState } from "./RestoreState";
import { Store } from "./Store";

export class ArrayStore<A extends IBaseApp<A>, D extends BasicType> extends Store<A, D>
{
    private _items:Array<D> = [];

    constructor(storage:IStorage<A>, id:string, storeData?:() => boolean, autoCommit:boolean=false)
    {
        super(storage, id, storeData, autoCommit);
    }

    public async restore():Promise<ArrayStore<A, D> | IError>
    {
        try
        {
            if (this._restoreState !== RestoreState.Default) this._storage.app.throw('Store must be in default state', [], {correctable:true});

            this._restoreState = RestoreState.Restoring;

            this._items = this._storage.app.extractOrRethrow(await this.getStoredData<Array<D>>()) ?? this._items;

            this._restoreState = RestoreState.Restored;

            return this;
        }
        catch (error)
        {
            return this._storage.app.warn(error, 'Failed to restore store', arguments, {errorOnly:true, names:[ArrayStore, this.restore]});
        }
    }

    public replace(items:Array<D>)
    {
        this.assertIsRestoredState();

        this._items.length = 0;
        for (let i = 0, length = items.length; i < length; i++) this._items.push(items[i]);
        
        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    public add(item:D)
    {
        this.assertIsRestoredState();

        if (this._items.indexOf(item) !== -1) 
        {
            this._storage.app.consoleUtil.warn(this.constructor, 'duplicate item');
            return;
        }

        this._items.push(item);

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    public replaceAt(index:number, item:D) 
    {
        this.assertIsRestoredState();
    
        //check if index is within the bounds of the array
        if (index < 0 || index >= this._items.length) this._storage.app.throw('Index out of bounds', []);
        
        let searchIndex = this._items.indexOf(item);
        if (searchIndex !== -1 && searchIndex !== index) 
        {
            this._storage.app.consoleUtil.warn(this.constructor, 'duplicate item');
            return;
        }

        this._items[index] = item;
    
        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }
    
    public remove(item:D)
    {
        this.assertIsRestoredState();

        let index = this._items.indexOf(item);
        if (index == -1) 
        {
            this._storage.app.consoleUtil.warn(this.constructor, 'item not found');
            return;
        }

        this._items.splice(index, 1);

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    public clear()
    {
        this.assertIsRestoredState();

        this._items.length = 0;

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    public has(item:D):boolean
    {
        this.assertIsRestoredState();

        return this._items.indexOf(item) !== -1;
    }

    public *items():Generator<D>
    {
        this.assertIsRestoredState();

        for (let i = 0, length = this._items.length; i < length; i++) yield this._items[i];
    }

    public get length():number
    {
        this.assertIsRestoredState();

        return this._items.length;
    }

    public find(predicate:(item:D) => boolean):D | undefined
    {
        this.assertIsRestoredState();

        return this._items.find(predicate);
    }

    public findIndex(predicate:(item: D) => boolean):number 
    {
        this.assertIsRestoredState();
    
        return this._items.findIndex(predicate);
    }
    
    public some(predicate:(item:D) => boolean):boolean
    {
        this.assertIsRestoredState();

        return this._items.some(predicate);
    }

    public override getData():Array<D>
    {
        this.assertIsRestoredState();

        return this._items;
    }
}
