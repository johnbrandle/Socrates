/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IDestructable } from "../../../../../../shared/src/library/IDestructable.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { InstanceManager as SharedInstanceManager } from "../../library/managers/InstanceManager.ts";
import type { IApp } from "../IApp.ts";
import { CustomSlide } from "../components/view/transition/effects/CustomSlide.ts";

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
export class InstanceManager<A extends IApp<A>> extends SharedInstanceManager<A>
{
    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }

    public create<T extends IDestructable<A>>(destructor:IDestructor<A>, uid:string, options:{args?:any[], id?:undefined, strong?:false}):T;  
    public create<T extends IDestructable<A>>(destructor:IDestructor<A>, uid:string, options:{args?:any[], id:string, strong?:boolean}):T;  
    public create<T extends IDestructable<A> | WeakKey>(arg1:T extends IDestructor<A> ? IDestructor<A> : string, arg2?:T extends IDestructor<A> ? string : {args?:any[], id?:string, strong?:false | undefined}, options?:{args?:any[], id:string, strong:boolean} | {args?:any[], id?:undefined, strong?:false}):T | undefined;
    public create<T extends IDestructable<A> | WeakKey>(...args:unknown[]):T | undefined
    {
        if (this._app.typeUtil.isString(args[0]) !== true)
        {
            const [destructor, uid, options] = args as [IDestructor<A>, string, {args?:any[], id?:string, strong:true}];

            switch (uid)
            {
                case 'effect:CustomSlide':
                    return this._create(destructor, CustomSlide, options) as T;
                default:
                    return super.create(destructor, uid, options as any) as T;
            }
        }
        else
        {
            const [uid, options] = args as [string, {args?:any[], id?:string, strong?:false | undefined}];

            switch (uid)
            {
                default:
                    //@ts-ignore
                    return super.create(uid, options) as T;
            }
        }
    }
}