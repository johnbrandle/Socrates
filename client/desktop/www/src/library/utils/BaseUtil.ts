/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { BaseUtil as Shared, type base64 } from '../../../../../../shared/src/library/utils/BaseUtil.ts';
import { IAbortableType, type IAbortable } from '../../../../../../shared/src/library/abort/IAbortable.ts';
import { BinaryWorkerController } from '../workers/binary/BinaryWorkerController.ts';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../IBaseApp.ts';

export * from '../../../../../../shared/src/library/utils/BaseUtil.ts';

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class BaseUtil<A extends IBaseApp<A>> extends Shared<A> 
{
    public override toBase64<T extends base64=base64>(input:Uint8Array, abortable:IAbortable):Promise<base64 | undefined>;
    public override toBase64<T extends base64=base64>(input:string, abortable:IAbortable, isLatin1?:boolean):Promise<base64 | undefined>;
    public override toBase64<T extends base64=base64>(input:Uint8Array):T;
    public override toBase64<T extends base64=base64>(input:string, isLatin1?:boolean):T;
    public override toBase64<T extends base64=base64>(input:Uint8Array | string, ...args:any[])
    {
        let workerController:BinaryWorkerController<any> | undefined;

        try
        {
            if (this._app.typeUtil.is<IAbortable>(args[1], IAbortableType) !== true) return super.toBase64<T>(input as any, args[1]);
        
            //this part is just a worker test, i don't see a situation where we would need to base64 in a worker

            const [abortable, isLatin1] = args as [IAbortable, boolean?];

            workerController = new BinaryWorkerController(this._app, this._app, abortable);
            return workerController.toBase64(input, isLatin1);
        }
        finally
        {
            workerController?.dnit();
        }
    }
}