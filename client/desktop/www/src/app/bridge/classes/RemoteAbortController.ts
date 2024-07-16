import type { RemoteAbortController as BridgeRemoteAbortController } from "../../../../../src/app/api/classes/RemoteAbortController";
import type { IApp } from "../../IApp";

//https://stackoverflow.com/questions/51865430/typescript-compiler-does-not-know-about-es6-proxy-trap-on-class
function fakeBaseClass<T>() : new() => Pick<T, keyof T> { return class {} as any; }

/**
 * @forceSuperTransformer_ignoreParent (fakeBaseClass is not supported by the transformer)
 */
export class RemoteAbortController<A extends IApp<A>> extends fakeBaseClass<BridgeRemoteAbortController>()
{
    //@ts-ignore
    public constructor(app:A)
    {
        return new app.bridgeManager.api.streaming.classes.RemoteAbortController();
    }
}