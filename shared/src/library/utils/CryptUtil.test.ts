/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../IBaseApp";
import { TestSuite } from "../test/TestSuite.test";
import { HashOutputFormat } from "./HashUtil";
import { KeyType } from "./KeyUtil";

const NUMBER_OF_BYTES = 2**24; //256MB
const bytes = new Uint8Array(NUMBER_OF_BYTES);
for (let i = 0; i < NUMBER_OF_BYTES; i++) bytes[i] = Math.floor(Math.random() * 256);

export class CryptUtilTestSuite<A extends IBaseApp<A>> extends TestSuite<A> 
{
    public override async init():Promise<TestSuite<A>>
    {
        await super.init();
     
        this.addTest(this.CryptUtil_encrypt_decrypt);
        this.addTest(this.CryptUtil_encrypt_decrypt_transformer);
        this.addTest(this.CryptUtil_encrypt_decrypt_variableTransformer);
    
        return this;
    }

    public async CryptUtil_encrypt_decrypt():Promise<string>
    {
        //next, generate a random hkdf key
        const cryptKey = await this._app.keyUtil.import(this._app.hashUtil.generate(512, HashOutputFormat.Hex), KeyType.CRYPT);

        //next, measure the time it takes to encrypt the data
        const a = performance.now();
        const encrypted = await this._app.cryptUtil.encrypt(cryptKey, bytes);
        const b = performance.now();
        const diff1 = b - a;

        //next, measure the time it takes to decrypt the data
        const c = performance.now();
        const decrypted = await this._app.cryptUtil.decrypt(cryptKey, encrypted!);
        const d = performance.now();
        const diff2 = d - c;

        //next, compare the original data to the decrypted data
        this.assertEquals(bytes, decrypted, {id:'data !== decrypted'});
        
        return `encrypt ${diff1.toFixed(0)}, decrypt ${diff2.toFixed(0)}`;
    }

    public async CryptUtil_encrypt_decrypt_transformer():Promise<string>
    {
        //next, generate a random hkdf key
        const hkdfKey = await this._app.keyUtil.import(this._app.hashUtil.generate(512, HashOutputFormat.Hex), KeyType.CRYPT);

        const [encryptionTransfomer, headerPromise, format] = this._app.cryptUtil.createTransformer(hkdfKey, 0);
        const encryptStream = this._app.streamUtil.transform(this._app.streamUtil.fromUint8Array(bytes), [encryptionTransfomer]);

        //next, measure the time it takes to encrypt the data
        const a = performance.now();
        const encrypted = await this._app.streamUtil.toUint8Array(encryptStream);
        const b = performance.now();
        const diff1 = b - a;

        const header = await headerPromise;

        const decryptStream = this._app.streamUtil.transform(this._app.streamUtil.fromUint8Array(encrypted), [this._app.cryptUtil.createTransformer(hkdfKey, 0, header, format)]);

        //next, measure the time it takes to decrypt the data
        const c = performance.now();
        const decrypted = await this._app.streamUtil.toUint8Array(decryptStream);
        const d = performance.now();
        const diff2 = d - c;

        //next, compare the original data to the decrypted data
        this.assertEquals(bytes, decrypted, {id:'data !== decrypted'});
        
        return `encrypt ${diff1.toFixed(0)}, decrypt ${diff2.toFixed(0)}`;
    }

    public async CryptUtil_encrypt_decrypt_variableTransformer():Promise<string>
    {
        //next, generate a random hkdf key
        const hkdfKey = await this._app.keyUtil.import(this._app.hashUtil.generate(512, HashOutputFormat.Hex), KeyType.CRYPT);

        const [encryptionTransfomer, format] = this._app.cryptUtil.createVariableTransformer(hkdfKey, 0);
        const encryptStream = this._app.streamUtil.transform(this._app.streamUtil.fromUint8Array(bytes), [encryptionTransfomer], {allowVariableByteLengthTransformers:true});

        //next, measure the time it takes to encrypt the data
        const a = performance.now();
        const encrypted = await this._app.streamUtil.toUint8Array(encryptStream);
        const b = performance.now();
        const diff1 = b - a;

        const decryptStream = this._app.streamUtil.transform(this._app.streamUtil.fromUint8Array(encrypted), [this._app.cryptUtil.createVariableTransformer(hkdfKey, 0, format)], {allowVariableByteLengthTransformers:true});

        //next, measure the time it takes to decrypt the data
        const c = performance.now();
        const decrypted = await this._app.streamUtil.toUint8Array(decryptStream);
        const d = performance.now();
        const diff2 = d - c;

        //next, compare the original data to the decrypted data
        this.assertEquals(bytes, decrypted, {id:'data !== decrypted'});
        
        return `encrypt ${diff1.toFixed(0)}, decrypt ${diff2.toFixed(0)}`;
    }
}