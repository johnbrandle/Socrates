/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../../../../../shared/src/library/decorators/ImplementsDecorator.ts";
import { DestructableEntity } from "../../../../../shared/src/library/entity/DestructableEntity.ts";
import type { IError } from "../../../../../shared/src/library/error/IError.ts";
import type { IDestructor } from "../../../../../shared/src/library/IDestructor.ts";
import { type uid } from "../../../../../shared/src/library/utils/UIDUtil.ts";
import type { IApp } from "../../app/IApp.ts";
import { IInstanceManagerType, type IInstanceManager } from "./IInstanceManager.ts";

/**
 * Manages instances of objects and provides methods for creating, getting, setting, and removing instances.
 */
@ImplementsDecorator(IInstanceManagerType)
export class InstanceManager<A extends IApp<A>> extends DestructableEntity<A> implements IInstanceManager<A>
{
    #_instances = new Map<uid, any>();

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }

    public create(path:string[], args:any[]):uid | IError
    {
        const app = this._app;

        try
        {
            const originalPath = path;
            path = path.slice();

            let scope:any = this.app.apiManager.api;
            const className = path.pop()!;
            for (const part of path)
            {
                if (app.accessUtil.isValidPropAccess(scope, part) !== true) app.throw('class path not found: {}', [originalPath.join('->')]);
                
                scope = scope[part];
            }

            if (app.accessUtil.isValidPropAccess(scope, className) !== true) app.throw('class path not found: {}', [originalPath.join('->')]);

            const Class = scope[className];

            if (Class === undefined) app.throw('class path not found: {}', [originalPath.join('->')]);

            const uid = this._app.uidUtil.generate();

            const instance = new Class(this.app, ...args);

            this.#_instances.set(uid, instance);

            return uid;
        }
        catch (error)
        {
            return app.warn(error, 'errored creating instance: {}', [path, args], {errorOnly:true, names:[InstanceManager, this.create]});
        }
    }
    
    /**
     * Release an instance that was created by createInstance. (makes it available for garbage collection)
     * 
     * @param uid - the uid of the instance
     * @returns - true, or an error
     */
    public remove(uid:uid):true | IError
    {
        const app = this._app;

        try
        {
            if (this.#_instances.has(uid) !== true) return app.throw('instance does not exist', arguments);

            this.#_instances.delete(uid);

            return true;
        }
        catch (error)
        {
            return app.warn(error, 'errored destroying instance: {}', [uid], {errorOnly:true, names:[InstanceManager, this.remove]});
        }
    }

    public get(uid:uid):any | undefined
    {
        return this.#_instances.get(uid);
    }

    /**
     * Call a method on an instance that was created by createInstance.
     * 
     * @param uid - the uid of the instance
     * @param path - an array of strings that represent the path to the method, example: ['someMethod']
     * @param args - an array of arguments to pass to the method
     * @returns - the result of the method, or an error
     */
    public async callOn(uid:uid, path:string[], ...args:any[]):Promise<unknown | IError>
    {
        const app = this._app;
        
        try
        {
            if (this.#_instances.has(uid) === false) return app.throw('instance does not exist', arguments);

            const instance = this.#_instances.get(uid);

            const originalPath = path;
            path = path.slice();

            let scope:any = instance;
            const functionName = path.pop()!;
            for (const part of path)
            {
                if (app.accessUtil.isValidPropAccess(scope, part) !== true) app.throw('function path not found: {}', [originalPath.join('->')]);
                
                scope = scope[part];
            }

            if (app.accessUtil.isValidPropAccess(scope, functionName) !== true) app.throw('function path not found: {}', [originalPath.join('->')]);

            //call the function
            return await ((scope[functionName] as Function).apply(scope, args));
        }
        catch (error)
        {
            return app.warn(error, 'errored calling method on instance: {}', [uid, path, args], {names:[InstanceManager, this.callOn]});
        }
    }
}