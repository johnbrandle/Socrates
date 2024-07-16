import type { RemoteFileSystem as BridgeFileSystem } from "../../../../../src/app/api/classes/RemoteFileSystem";
import type { IApp } from "../../IApp";

//https://stackoverflow.com/questions/51865430/typescript-compiler-does-not-know-about-es6-proxy-trap-on-class
function fakeBaseClass<T>() : new() => Pick<T, keyof T> { return class {} as any; }

/**
 * @forceSuperTransformer_ignoreParent (fakeBaseClass is not supported by the transformer)
 */
export class RemoteFileSystem<A extends IApp<A>> extends fakeBaseClass<BridgeFileSystem>()
{
    //@ts-ignore
    public constructor(app:A, basePath:Paths)
    {
        return new app.bridgeManager.api.streaming.classes.RemoteFileSystem(basePath);
    }
}