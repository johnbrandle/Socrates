/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { TestSuite } from "../../../../../shared/src/library/test/TestSuite.test";
import { type IBaseApp } from "./IBaseApp";
import { ArrayUtilTestSuite } from "../../../../../shared/src/library/utils/ArrayUtil.test";
import { BaseUtilTestSuite } from "../../../../../shared/src/library/utils/BaseUtil.test";
import { KeyUtilTestSuite } from "../../../../../shared/src/library/utils/KeyUtil.test";
import { SortedBucketCollectionTestSuite } from "../../../../../shared/src/library/collection/SortedBucketCollection.test";
import { FileStorageTestSuite } from "./file/storage/FileStorage.test";
import type { IDestructor } from "../../../../../shared/src/library/IDestructor";
import { CryptUtilTestSuite } from "../../../../../shared/src/library/utils/CryptUtil.test";
import { ByteUtilTestSuite } from "../../../../../shared/src/library/utils/ByteUtil.test";
import { HashUtilTestSuite } from "./utils/HashUtil.test";
import { IntegerUtilTestSuite } from "../../../../../shared/src/library/utils/IntegerUtil.test";
import { SerializationUtilTestSuite } from "../../../../../shared/src/library/utils/SerializationUtil.test";

export class BaseAppTestSuite<A extends IBaseApp<A>> extends TestSuite<A>
{
    constructor(app:A, destructor:IDestructor<A>) 
    {
        super(app, destructor);
    }

    public override async init():Promise<TestSuite<A>>
    {
        await super.init(); //be sure to call this before our init code and return the promise

        const app = this._app;

        this.addSuite(await this.createSuite(IntegerUtilTestSuite));
        this.addSuite(await this.createSuite(ArrayUtilTestSuite));   
        this.addSuite(await this.createSuite(BaseUtilTestSuite));
        this.addSuite(await this.createSuite(KeyUtilTestSuite));
        this.addSuite(await this.createSuite(ByteUtilTestSuite));
        this.addSuite(await this.createSuite(HashUtilTestSuite));
        this.addSuite(await this.createSuite(CryptUtilTestSuite));
        this.addSuite(await this.createSuite(SortedBucketCollectionTestSuite));
        this.addSuite(await this.createSuite(SerializationUtilTestSuite));
        this.addSuite(await this.createSuite(FileStorageTestSuite));

        return this;
    }
}