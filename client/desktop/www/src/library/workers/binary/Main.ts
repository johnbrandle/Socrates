/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { TypeUtil } from "../../../../../../../shared/src/library/utils/TypeUtil.ts";
import { BaseUtil } from "../../utils/BaseUtil.ts";
import { BaseApp } from "../BaseApp.ts";
import type { IBaseApp } from "../IBaseApp.ts";
import { Worker, type Task } from "../Worker.ts"
import { BinaryBase64Task } from "./Shared.ts";

const _app = new (class extends BaseApp<IBaseApp<any>> 
{
    #_baseUtil:BaseUtil<any> | undefined;
    public get baseUtil():BaseUtil<any> { return this.#_baseUtil ??= new BaseUtil<any>(this); }

    #_typeUtil:TypeUtil<any> | undefined;
    public get typeUtil():TypeUtil<any> { return this.#_typeUtil ??= new TypeUtil<any>(this); }
})() as IBaseApp<any>;
type A = typeof _app;

class Main extends Worker<A>
{
    protected async execute(task:Task):Promise<any>
    {    
        try
        {
            switch(task.name)
            {
                case BinaryBase64Task.to:
                {
                    const input = task.args.input as Uint8Array | string;
                    const isLatin1 = task.args.isLatin1 as boolean | undefined;

                    const result = (_app.typeUtil.isString(input) === true) ? _app.baseUtil.toBase64(input, isLatin1) : _app.baseUtil.toBase64(input);
                    
                    task.result = result;
                    break;
                }
                default:
                    console.warn('Unknown task:', task.name);
            }
        }
        catch(error)
        {
            console.warn(error);
        }
        finally
        {
            this.end(task);
        }
    }
}

new Main(_app);