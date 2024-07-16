/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { AbortableEntity } from "./AbortableEntity";
import { IDestructableType, type IDestructable, OnDestruct } from "../IDestructable";
import { IDestructorType, type IDestructor } from "../IDestructor";
import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IBaseApp } from "../IBaseApp";
import { uid } from "../utils/UIDUtil";
import { IDestructableEntity, IDestructableEntityType } from "./IDestructableEntity";

@ImplementsDecorator(IDestructableType, IDestructorType, IDestructableEntityType)
export abstract class DestructableEntity<A extends IBaseApp<A>> extends AbortableEntity<A> implements IDestructableEntity<A>
{    
    constructor(app:A, destructor:IDestructor<A>, uid?:uid)
    {  
        super(app, uid);

        this.#_destructor = destructor;

        /**
         * Add this entity to the destructor's destructables set.
         * Three things to note here:
         *
         * 1) You must manually call dnit on the entity if you want to release it without releasing the destructor.  
         *    Example Scenario: 
         *    
         *             You have a class that can be reinitialized without being dnited, and you are using it as a destructor.
         *             So, imagine in the reinitialize method you are creating a new Entity and setting it to this._foo;
         *             If you don't dnit the old entity, it will still be in the destructor's destructables set,
         *             which means you will likely develop a memory leak.
         *
         *             class DestructableFoo extends Entity
         *             {
         *                 private _foo:Entity;
         *
         *                 constructor(app:A, destructor:IDestructor<A>, uid?:uid)
         *                 {
         *                     super(app, destructor, uid);
         *                 }
         *
         *                 reinitialize() //assume this could be called multiple times
         *                 {
         *                     if (this._foo !== undefined) this._foo.dnit(); //must call dnit here to prevent memory leak
         *                     this._foo = new Entity(this.app, this.destructor);
         *                 }
         *             }
         *
         * 2) If an extending class throws in the constructor after the entity is added, the destructor will still have a reference to this entity.
         *    This is could be a problem if one needs to destruct the entity but not the destructor.
         *    Example: 
         *             const foo = new DestructableFoo(this);
         *             const bar = new DestructableBar(foo); //throws in constructor 
         *             bar.dnit(); //we cannot call this because bar was not fully constructed, so the only way we can release bar is to dnit foo
         *
         * Solution: Execute code that could throw either before the super call or in an init method that is called after the entity is constructed
         *
         *   Example: 
         *             class DestructableBar extends DestructableFoo
         *             {
         *                 constructor(app:A, destructor:IDestructor<A>, uid?:uid)
         *                 {
         *                     SomeFunctionThatCouldThrow(); //this is okay because it's called before the super call
         *
         *                     super(app, destructor, uid);
         *
         *                     SomeFunctionThatCouldThrow(); //this is NOT okay because it's called after the super call but before the entity is constructed
         *                 }
         *             }
         *
         *             OR
         *
         *             class DestructableBar extends DestructableFoo
         *             {
         *                 constructor(app:A, destructor:IDestructor<A>, uid?:uid)
         *                 {
         *                     super(app, destructor, uid);
         *                 }
         *
         *                 init()
         *                 {
         *                     SomeFunctionThatCouldThrow(); //this is okay if init is called after the entity is constructed
         *                 }
         *             }
         *
         * 3) The entity's constructor must always return the default 'this' reference, so it can be optionally dnited by the caller.
         */

        destructor.addDestructable(this);

        return this;
    }

    #_destructor:IDestructor<A>;
    public get destructor():IDestructor<A> { return this.#_destructor; }

    //The size limit for the destructables set. If the set exceeds this limit, a warning will be logged indicating a potential memory leak.
    //override this in extending classes to set a custom limit if, and only if, it is necessary.
    protected _destructablesSizeLimit = 100;

    #_destructables:Set<IDestructable<A> | (() => Promise<any>)> = new Set();

    public addDestructable(destructable:IDestructable<A> | (() => Promise<any>)):void
    {
        const destructables = this.#_destructables;

        //we purposely use this.destructor rather than this._destructor because we may extend this class and override the destructor getter
        if (this.dnited === true) this._app.throw('Cannot access __destructables after dnit()', [], {correctable:true});

        if (destructables.size > this._destructablesSizeLimit) this.warn('The destructables set is getting large, indicating a potential memory leak. Increase the limit if necessary, but first ensure this is not a leak.', this.className, this.#_destructables.size, this.#_destructables);

        destructables.add(destructable);
    }

    public removeDestructable(destructable:IDestructable<A> | (() => Promise<any>)):boolean
    {
        return this.#_destructables.delete(destructable);   
    }

    protected _dnited = false;
    public get dnited():boolean { return this._dnited; }
    public async dnit():Promise<boolean>
    {
        if (this._dnited) return false;
        this._dnited = true;

        if (this._aborted === false) this._abort('dnited', undefined);

        //wait for any inprogress operations to finish
        await this.__turner.waitForTurnsToEnd(); //it's okay if new turns are aquired after this, as they will be aborted immediately given that aborted is true

        //destruct any destructables we own, and keep doing it till there are no more destructables (destructables could be added while we are destructing them)
        let count = 0;
        const destructables = this.#_destructables;
        while (destructables.size > 0 && count++ < 100)
        {
            const promises:Array<Promise<boolean>> = [];
            for (const destructable of destructables) 
            {
                try
                {
                    if (this._app.typeUtil.isFunction(destructable) === true) 
                    {
                        this.removeDestructable(destructable); //functions are not expected to self remove from the destructables set
                        promises.push(destructable());
                    }
                    else promises.push(destructable.dnit());
                }
                catch (error)
                {
                    this._app.warn(error, 'Error in dniting object', [destructable], {names:[this.className, this.dnit]});

                    //remove the destructable from the set so we don't try to dnit it again
                    this.removeDestructable(destructable);
                }
            }
            await Promise.all(promises); //it's possible that while we are waiting for the promises to resolve, more entities are added to the owned set
        }
        if (count >= 100) this._app.throw('too many attempts to dnit', [], {correctable:true});

        const success = this.#_destructor.removeDestructable(this);
        if (success === false) this._app.throw('Failed to remove entity from destructor', [], {correctable:true});

        this.#_destructor = undefined!;

        this.onChangeSignal.dispatch(this, OnDestruct, undefined);
        this._app.observableManager.unregister(this);

        return true;
    }
}