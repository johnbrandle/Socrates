/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import { TestSuite } from "../../../../../../shared/src/library/test/TestSuite.test";
import { HashOutputFormat, HashType, type HashableData } from "./HashUtil";

export class HashUtilTestSuite<A extends IBaseApp<A>> extends TestSuite<A> 
{
    public override async init():Promise<TestSuite<A>>
    {
        await super.init();
     
        this.addTest(this.HashUtil_hashSHA256);

        return this;
    }

    public async HashUtil_hashSHA256():Promise<string>
    {
        const bytes:Uint8Array[] = [];
        for (let i = 0; i < 10000; i++) bytes[i] = this._app.byteUtil.generate(Math.min(512, i), {insecure:true});
        
        const a = performance.now();
        const hashes1 = [];
        for (let i = 0; i < 10000; i++) hashes1[i] = this._app.hashUtil.derive(bytes[i] as HashableData, HashType.SHA_256, HashOutputFormat.hex, true);
        const b = performance.now();

        const diff1 = b - a;

        const c = performance.now();
        const promises = [];
        for (let i = 0; i < 10000; i++) promises[i] = this._app.hashUtil.derive(bytes[i] as HashableData, HashType.SHA_256, HashOutputFormat.hex);
        const hashes2 = await Promise.all(promises);
        const d = performance.now();

        const diff2 = d - c;

        for (let i = hashes1.length; i--;) this.assertEquals(hashes1[i], hashes2[i], {id:`hashes1[${i}] !== hashes2[${i}]`});

        return `sync ${diff1}, async ${diff2}`;
    }
}