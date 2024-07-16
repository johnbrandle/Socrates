/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";

export const ProxyTarget = Symbol('target');

@SealedDecorator()
export class ProxyUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Creates a proxy that simulates the behavior of a specified object type. The method relies on two callback 
     * functions, `onApply` and `onNew`, which define custom behaviors for method invocations and constructor 
     * invocations on proxy objects, respectively.
     * 
     * Example:
     * 
     * //defined on the server
     * class Foo
     * {
     *    async test():Promise<string>
     *    {
     *       return 'Hello World';
     *    }
     * }
     * 
     * const foo = ProxyUtil.createImpersonator<Foo>((propPath, args) =>
     * {
     *    return this.server.api.objects.foo.send({propPath, args});
     * });
     * 
     * //use the impersonator as if it were an instance of Foo
     * const result = await foo.test();
     * 
     * //result is 'Hello World' (from the server)
     * 
     * @note This method is designed primarily for method invocations and does not directly support property accesses. While 
     * it can be employed in a variety of scenarios, its capabilities are especially beneficial for implementing RPCs, where 
     * method calls are forwarded to remote services. 
     * 
     * @param onApply A callback function that is called when a method on the proxy object is invoked.
     * @param onNew A callback function that is called when a proxy object is constructed. 
     * @returns {T} A proxy object that simulates the behavior of the specified object type.
     */
    public createImpersonator<T>(onApply:(propPath:string[], args:any[]) => void, onNew?:(propPath:string[], args:any[]) => object):T
    {
        //this will recursively create proxies to track property accesses
        const createProxy = (propPath:string[]):any => 
        {
            const target = function () {};
            //dummy function target to allow calling the proxy as a function
            return new Proxy(target, 
            { 
                construct(_:any, args:any[]):object
                {
                    return onNew !== undefined ? onNew(propPath, args) : createProxy([]);
                },
                get(_:any, prop:string | symbol) 
                {
                    if (prop === ProxyTarget) return target;
                    if (typeof prop === 'symbol') return undefined;

                    //continue tracking property path
                    return createProxy([...propPath, prop]);
                },
                apply(_:any, _thisArg:any, args:any[]) 
                {
                    //when the proxy (as a function) is called, execute the callback with the path and arguments
                    return onApply(propPath, args);
                }
            });
        }
    
        //initialize with an empty property path
        return createProxy([]); 
    }

    public isProxy(value:any):boolean
    {
        return value?.[ProxyTarget] !== undefined;
    }

    public getTarget<T extends Object>(value:any):T | undefined
    {
        return value?.[ProxyTarget];
    }
}