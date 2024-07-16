/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { KeyType, type Salt } from "./KeyUtil";
import { TestSuite } from "../test/TestSuite.test";
import { IBaseApp } from "../IBaseApp";

export class ByteUtilTestSuite<A extends IBaseApp<A>> extends TestSuite<A> 
{
    public override async init():Promise<TestSuite<A>>
    {
        await super.init();
     
        this.addTest(this.ByteUtil_derive);

        return this;
    }

    public async ByteUtil_derive():Promise<string>
    {
        const hkdfKey = await this._app.keyUtil.generate(KeyType.HKDF);

        const salt = this._app.byteUtil.generate<Salt>(32, {insecure:true});

        const a = performance.now();
        await this._app.byteUtil.derive(hkdfKey, salt, 8160);
        const b = performance.now();

        const diff1 = b - a;

        return `${diff1}`;
    }
}