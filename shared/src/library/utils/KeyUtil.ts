/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @important ALL changes to this util and dependant utils must be well tested!
 */

import { SealedDecorator } from '../decorators/SealedDecorator.ts';
import { type emptystring } from './StringUtil.ts';
import { HashOutputFormat, HashType, Hex_128, Hex_160, Hex_256, Hex_384, Hex_512, hex_128, hex_160, hex_256, hex_384, hex_512 } from './HashUtil.ts';
import { uid } from './UIDUtil.ts';
import { IBaseApp } from '../IBaseApp.ts';

export type salt = hex_128 | hex_160 | hex_256 | hex_384 | hex_512;
export type Salt = Hex_128 | Hex_160 | Hex_256 | Hex_384 | Hex_512;

export type HKDFKey = 
{
    readonly cryptoKey:CryptoKey, 
    readonly salt:salt | emptystring, 
    readonly uid:uid,
} & {_brand:'HKDFKey'};

export type PBKDF2Key =
{
    readonly cryptoKey:CryptoKey, 
} & {_brand:'PBKDF2Key'};

export type HMACKey<T extends HashType> = 
{
    readonly cryptoKey:CryptoKey, 
    readonly outputHashType:T
} & {_brand:'HMACKey'};

export type KWKey = 
{
    readonly cryptoKey:CryptoKey
} & {_brand:'KWKey'};

export type GCMKey = 
{
    readonly cryptoKey:CryptoKey
} & {_brand:'GCMKey'};

export type CTRKey = 
{
    readonly cryptoKey:CryptoKey
} & {_brand:'CTRKey'};

export type CBCKey = 
{
    readonly cryptoKey:CryptoKey
} & {_brand:'CBCKey'};

export type CRYPTKey = 
{
    readonly cryptoKey:CryptoKey, 
    readonly salt:salt | emptystring,
    readonly uid:uid,
    readonly hmacKey:HMACKey<HashType.SHA_384>
} & {_brand:'CRYPTKey'};

export type WrapData_256 = Hex_256 & {_brand2:'WrapData_256'};
export type WrapData_512 = Hex_512 & {_brand2:'WrapData_512'};

export type WrappedData_320 = Uint8Array & {_brand2:'WrappedData_256'};
export type WrappedData_576 = Uint8Array & {_brand2:'WrappedData_512'};

export type WrappedGCMKey = Uint8Array & {_brand:'WrappedGCMKey'};
export type WrappedCTRKey = Uint8Array & {_brand:'WrappedCTRKey'};
export type WrappedCBCKey = Uint8Array & {_brand:'WrappedCBCKey'};

export enum KeyType
{
    GCM = 'AES-GCM',
    CTR = 'AES-CTR',
    CBC = 'AES-CBC',
    KW = 'AES-KW',
    PBKDF2 = 'PBKDF2',
    HMAC = 'HMAC',
    HKDF = 'HKDF',
    CRYPT = 'CRYPT',
}

export enum CryptoOutputFormat
{
    hex = 'hex',
    Hex = 'Hex',
}

@SealedDecorator()
export class KeyUtil<A extends IBaseApp<A>>
{
    protected _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    private _ctrKey:Promise<CTRKey> | undefined;
    public get __CTR_KEY():Promise<CTRKey> 
    { 
        if (this._ctrKey !== undefined) return this._ctrKey;

        return this._ctrKey = crypto.subtle.importKey('raw', this._app.baseUtil.fromHex(this._app.configUtil.get(true).classes.KeyUtil.frozen.ctrKey_hex_256 as hex_256), {name:KeyType.CTR, length:256}, false, ['encrypt']).then(cryptoKey => ({cryptoKey} as CTRKey));
    };

    public async generate(type:KeyType.GCM, extractable?:boolean):Promise<GCMKey>;
    public async generate(type:KeyType.CTR, extractable?:boolean):Promise<CTRKey>;
    public async generate(type:KeyType.CBC, extractable?:boolean):Promise<CBCKey>;
    public async generate(type:KeyType.HMAC, outputHashType:HashType.SHA_256):Promise<HMACKey<HashType.SHA_256>>;
    public async generate(type:KeyType.HMAC, outputHashType:HashType.SHA_512):Promise<HMACKey<HashType.SHA_384>>;
    public async generate(type:KeyType.HMAC, outputHashType:HashType.SHA_512):Promise<HMACKey<HashType.SHA_512>>;
    public async generate(type:KeyType.HKDF):Promise<HKDFKey>;
    public async generate(type:KeyType.CRYPT):Promise<CRYPTKey>;
    public async generate(type:KeyType, ...args:any[])
    {
        switch (type)
        {
            case KeyType.GCM:
            case KeyType.CTR:
            case KeyType.CBC:
            {
                const extractable = args[0] === true;

                const cryptoKey = await crypto.subtle.generateKey({name:type, length:256}, extractable, ['encrypt', 'decrypt']);
                return await this.create(cryptoKey, type as KeyType.GCM) as GCMKey | CTRKey | CBCKey;
            }
            case KeyType.HMAC:
            {
                const outputHashType = args[0] as HashType.SHA_256 | HashType.SHA_384 | HashType.SHA_512;

                const cryptoKey = await crypto.subtle.generateKey({name:type, hash:{name:outputHashType}, length:512}, false, ['sign', 'verify']);
                return await this.create(cryptoKey, type, outputHashType as HashType.SHA_256) as HMACKey<any>;
            }
            case KeyType.HKDF:
            case KeyType.CRYPT:
            {
                return await this.import(this._app.hashUtil.generate(512, HashOutputFormat.Hex), type as KeyType.CRYPT) as HKDFKey | CRYPTKey;
            }
        }
    }

    public async export(key:GCMKey | CTRKey | CBCKey, format:CryptoOutputFormat.hex):Promise<hex_256>;
    public async export(key:GCMKey | CTRKey | CBCKey, format:CryptoOutputFormat.Hex):Promise<Hex_256>;
    public async export(key:GCMKey | CTRKey | CBCKey, format:CryptoOutputFormat=CryptoOutputFormat.Hex):Promise<hex_256 | Hex_256>
    {
        const keyData = new Uint8Array(await crypto.subtle.exportKey('raw', key.cryptoKey));

        return format === CryptoOutputFormat.hex ? this._app.baseUtil.toHex<hex_256>(keyData) : keyData as Hex_256;
    }

    public async import(keyData:hex_256 | Hex_256, type:KeyType.GCM, extractable?:boolean):Promise<GCMKey>;
    public async import(keyData:hex_256 | Hex_256, type:KeyType.CTR, extractable?:boolean):Promise<CTRKey>;
    public async import(keyData:hex_256 | Hex_256, type:KeyType.CBC, extractable?:boolean):Promise<CBCKey>;
    public async import(keyData:hex_512 | Hex_512, type:KeyType.HMAC, outputHashType:HashType.SHA_256):Promise<HMACKey<HashType.SHA_256>>;
    public async import(keyData:hex_512 | Hex_512, type:KeyType.HMAC, outputHashType:HashType.SHA_384):Promise<HMACKey<HashType.SHA_384>>;
    public async import(keyData:hex_512 | Hex_512, type:KeyType.HMAC, outputHashType:HashType.SHA_512):Promise<HMACKey<HashType.SHA_512>>;
    public async import(keyData:hex_512 | Hex_512, type:KeyType.HKDF):Promise<HKDFKey>;
    public async import(keyData:Uint8Array, type:KeyType.PBKDF2):Promise<PBKDF2Key>;
    public async import(keyData:hex_512 | Hex_512, type:KeyType.CRYPT):Promise<CRYPTKey>;
    public async import(keyData:Uint8Array | hex_256 | hex_512 | Hex_256 | Hex_512, type:KeyType.GCM | KeyType.CTR | KeyType.CBC | KeyType.PBKDF2 | KeyType.HMAC | KeyType.HKDF | KeyType.CRYPT, ...args:any[]):Promise<GCMKey | CTRKey | CBCKey | PBKDF2Key | HMACKey<any> | HKDFKey | CRYPTKey>
    {
        if (keyData === undefined) this._app.throw('keyData is undefined', [], {correctable:true});
        if (this._app.typeUtil.isString(keyData) === true) keyData = this._app.baseUtil.fromHex<Hex_256 | Hex_512>(keyData);

        if (type !== KeyType.PBKDF2 && (keyData.length !== 32 && keyData.length !== 64)) this._app.throw('invalid key length', [], {correctable:true});

        switch (type)
        {
            case KeyType.CTR:
            case KeyType.CBC:
            case KeyType.GCM:
            {
                const extractable = args[0] === true;
                const cryptoKey = await crypto.subtle.importKey('raw', keyData, {name:type, length:256}, extractable, ['encrypt', 'decrypt']);
                return await this.create(cryptoKey, type as KeyType.GCM) as GCMKey | CTRKey | CBCKey;
            }
            case KeyType.PBKDF2:
            {
                const cryptoKey = await crypto.subtle.importKey('raw', keyData, {name:type}, false, ['deriveKey', 'deriveBits']);
                return await this.create(cryptoKey, type) as PBKDF2Key;
            }
            case KeyType.HMAC:
            {
                const outputHashType = args[0] as HashType.SHA_256 | HashType.SHA_384 | HashType.SHA_512;
                const cryptoKey = await crypto.subtle.importKey('raw', keyData, {name:type, hash:{name:outputHashType}}, false, ['sign', 'verify']);
                return await this.create(cryptoKey, type, outputHashType as HashType.SHA_256) as HMACKey<any>;
            }
            case KeyType.HKDF:
            case KeyType.CRYPT:
            {
                const config = this._app.configUtil.get(true).classes.KeyUtil.frozen;
                const app = this._app;

                const uid = await app.hashUtil.derive(app.hashUtil.encodeData([keyData, config.uidLabel_hex_128 as hex_128]), HashType.SHA_256, HashOutputFormat.hex) as uid;
                const salt = '';

                const cryptoKey = await crypto.subtle.importKey('raw', keyData, {name:KeyType.HKDF, hash:{name:HashType.SHA_512}}, false, ['deriveKey', 'deriveBits']);
                
                return await this.create(cryptoKey, type as KeyType.CRYPT, salt, uid) as HKDFKey | CRYPTKey;
            }
            default:
                this._app.throw('invalid type', [], {correctable:true});
        }
    }

    public async wrap(wrapperKey:KWKey, wrapKey:GCMKey):Promise<WrappedGCMKey>;
    public async wrap(wrapperKey:KWKey, wrapKey:CTRKey):Promise<WrappedCTRKey>;
    public async wrap(wrapperKey:KWKey, wrapKey:CBCKey):Promise<WrappedCBCKey>;
    public async wrap(wrapperKey:KWKey, wrapData:WrapData_256):Promise<WrappedData_320>;
    public async wrap(wrapperKey:KWKey, wrapData:WrapData_512):Promise<WrappedData_576>;
    public async wrap(wrapperKey:KWKey, wrapKey:GCMKey | CTRKey | CBCKey | HMACKey<any> | WrapData_256 | WrapData_512)
    {
        if (wrapKey instanceof Uint8Array)
        {
            switch (wrapKey.length)
            {
                case 32:
                {
                    const cryptoKey = await crypto.subtle.importKey('raw', wrapKey, {name:KeyType.HMAC, hash:{name:HashType.SHA_256}}, true, ['sign', 'verify']);
                    wrapKey = {cryptoKey, outputHashType:HashType.SHA_256} as HMACKey<HashType.SHA_256>;
                    break;
                }
                case 64:
                {
                    const cryptoKey = await crypto.subtle.importKey('raw', wrapKey, {name:KeyType.HMAC, hash:{name:HashType.SHA_512}}, true, ['sign', 'verify']);
                    wrapKey = {cryptoKey, outputHashType:HashType.SHA_512} as HMACKey<HashType.SHA_512>;
                    break;
                }
                default:
                    this._app.throw('invalid key length', [], {correctable:true});
            }
        }

        return new Uint8Array(await window.crypto.subtle.wrapKey('raw', wrapKey.cryptoKey, wrapperKey.cryptoKey, {name:KeyType.KW}));
    }

    public async unwrap(wrapperKey:KWKey, keyData:WrappedGCMKey, type:KeyType.GCM, extractable?:boolean):Promise<GCMKey>;
    public async unwrap(wrapperKey:KWKey, keyData:WrappedCTRKey, type:KeyType.CTR, extractable?:boolean):Promise<CTRKey>;
    public async unwrap(wrapperKey:KWKey, keyData:WrappedCBCKey, type:KeyType.CBC, extractable?:boolean):Promise<CBCKey>;
    public async unwrap(wrapperKey:KWKey, wrapData:WrappedData_320):Promise<WrapData_256>;
    public async unwrap(wrapperKey:KWKey, wrapData:WrappedData_576):Promise<WrapData_512>;
    public async unwrap(wrapperKey:KWKey, keyData:Uint8Array, ...args:any[]):Promise<GCMKey | CTRKey | CBCKey | WrapData_256 | WrapData_512>
    {
        if (args[0] === undefined)
        {
            const cryptoKey = await window.crypto.subtle.unwrapKey('raw', this._app.byteUtil.toArrayBuffer(keyData), wrapperKey.cryptoKey, {name:KeyType.KW}, {name:KeyType.HMAC, hash:{name:HashType.SHA_512}}, true, ['sign', 'verify']);
            
            return new Uint8Array(await crypto.subtle.exportKey('raw', cryptoKey)) as WrapData_256 | WrapData_512;
        }

        const type = args[0] as KeyType.GCM | KeyType.CTR | KeyType.CBC;
        const extractable = args[1] === true;

        //convert the Uint8Array key data back into an ArrayBuffer as required by unwrapKey
        const wrappedKeyArrayBuffer = this._app.byteUtil.toArrayBuffer(keyData);

        let usages:KeyUsage[];
        let params:AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm;
        switch (type)
        {
            case KeyType.GCM:
            case KeyType.CTR:
            case KeyType.CBC:
                usages = ['encrypt', 'decrypt'];
                params = {name:type};
                break;
            default:
                this._app.throw('invalid type', [], {correctable:true});
        }

        const cryptoKey = await window.crypto.subtle.unwrapKey('raw', wrappedKeyArrayBuffer, wrapperKey.cryptoKey, {name:KeyType.KW}, params, extractable === true, usages);

        return await this.create(cryptoKey, type as KeyType.GCM) as GCMKey | CTRKey | CBCKey;
    }

    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, type:KeyType.GCM, extractable?:boolean):Promise<GCMKey>;
    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, type:KeyType.CTR, extractable?:boolean):Promise<CTRKey>;
    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, type:KeyType.CBC, extractable?:boolean):Promise<CBCKey>;
    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, type:KeyType.HMAC, outputHashType:HashType.SHA_256):Promise<HMACKey<HashType.SHA_256>>;
    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, type:KeyType.HMAC, outputHashType:HashType.SHA_384):Promise<HMACKey<HashType.SHA_384>>;
    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, type:KeyType.HMAC, outputHashType:HashType.SHA_512):Promise<HMACKey<HashType.SHA_512>>;
    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, type:KeyType.KW):Promise<KWKey>;
    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, type:KeyType.HKDF):Promise<HKDFKey>;
    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, type:KeyType.CRYPT):Promise<CRYPTKey>;
    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, type:KeyType, ...args:any[])
    {
        if (this._app.typeUtil.isString(salt) === true) salt = this._app.baseUtil.fromHex<Salt>(salt);

        if (hkdfKey.cryptoKey.algorithm.name !== KeyType.HKDF) this._app.throw('masterKey must be an HKDF key', [], {correctable:true});
        if (salt.length < 16) this._app.throw('salt must be at least 16 bytes', [], {correctable:true});

        let extractable = false;

        let derivedKeyType;
        let usages:KeyUsage[];

        switch (type)
        {
            case KeyType.GCM:
            case KeyType.CTR:
            case KeyType.CBC:
                extractable = args[0] === true;
                derivedKeyType = {name:type, length:256};
                usages = ['encrypt', 'decrypt'];
                break;
            case KeyType.HMAC:
                const outputHashType = args[0] as HashType.SHA_256 | HashType.SHA_384 | HashType.SHA_512;
                derivedKeyType = {name:type, hash:{name:outputHashType}};
                usages = ['sign', 'verify'];
                break;
            case KeyType.KW:
                derivedKeyType = {name:KeyType.KW, length:256};
                usages = ['wrapKey', 'unwrapKey'];
                break;
            case KeyType.HKDF:
            case KeyType.CRYPT:
                const config = this._app.configUtil.get(true).classes.KeyUtil.frozen;

                //combine the hkdf key salt with the provided salt
                //hash the combined salt so we can keep salts at a reasonable length 
                //technically crypt keys are hkdf keys, so we need to ensure domain separation
                const encodedData = this._app.hashUtil.encodeData([hkdfKey.salt, salt, (KeyType.HKDF ? config.hkdfLabel_hex_128 : config.cryptLabel_hex_128) as hex_128]);
                const hkdfSalt = await this._app.hashUtil.derive(encodedData, HashType.SHA_512, HashOutputFormat.hex);

                //use the first 64 characters of the salt as the uid
                const uid = hkdfSalt.slice(0, 64) as uid;

                return await this.create(hkdfKey.cryptoKey, type as KeyType.HKDF, hkdfSalt, uid) as HKDFKey | CRYPTKey;
            default:
                this._app.throw('invalid type', [], {correctable:true});
        }

        //combine the hkdf key salt with the provided salt
        const encoded = this._app.hashUtil.encodeData([hkdfKey.salt, salt]);

        //use the encoded data directly as the derivation info parameter
        const derivationInfo = encoded;

        //hash the encoded data to use as the salt
        const derivationSalt = await this._app.hashUtil.derive(derivationInfo, HashType.SHA_512, HashOutputFormat.Hex);

        //derive the key
        const cryptoKey = await crypto.subtle.deriveKey({name:KeyType.HKDF, salt:derivationSalt, info:derivationInfo, hash:HashType.SHA_512}, hkdfKey.cryptoKey, derivedKeyType, extractable, usages);
    
        //create the key object
        if (type === KeyType.HMAC) return await this.create(cryptoKey, type, args[0] as HashType.SHA_256) as HMACKey<any>;
        return await this.create(cryptoKey, type as KeyType.GCM) as GCMKey | CTRKey | CBCKey | KWKey;
    }

    private async create(cryptoKey:CryptoKey, type:KeyType.GCM):Promise<GCMKey>;
    private async create(cryptoKey:CryptoKey, type:KeyType.CTR):Promise<CTRKey>;
    private async create(cryptoKey:CryptoKey, type:KeyType.CBC):Promise<CBCKey>;
    private async create(cryptoKey:CryptoKey, type:KeyType.PBKDF2):Promise<PBKDF2Key>;
    private async create(cryptoKey:CryptoKey, type:KeyType.HMAC, outputHashType:HashType.SHA_256):Promise<HMACKey<HashType.SHA_256>>;
    private async create(cryptoKey:CryptoKey, type:KeyType.HMAC, outputHashType:HashType.SHA_384):Promise<HMACKey<HashType.SHA_384>>;
    private async create(cryptoKey:CryptoKey, type:KeyType.HMAC, outputHashType:HashType.SHA_512):Promise<HMACKey<HashType.SHA_512>>;
    private async create(cryptoKey:CryptoKey, type:KeyType.HKDF, salt:salt | emptystring, uid:uid):Promise<HKDFKey>;
    private async create(cryptoKey:CryptoKey, type:KeyType.CRYPT, salt:salt | emptystring, uid:uid):Promise<CRYPTKey>;
    private async create(cryptoKey:CryptoKey, type:KeyType.KW):Promise<KWKey>;
    private async create(cryptoKey:CryptoKey, type:KeyType, ...args:any[]):Promise<GCMKey | CTRKey | CBCKey | PBKDF2Key | HMACKey<any> | HKDFKey | CRYPTKey | KWKey>
    {
        let key:GCMKey | CTRKey | CBCKey | PBKDF2Key | HMACKey<any> | HKDFKey | CRYPTKey | KWKey;
        switch (type)
        {
            case KeyType.CTR:
            case KeyType.CBC:
            case KeyType.GCM:
            case KeyType.KW:
            case KeyType.PBKDF2:
            {
                key = {cryptoKey} as CBCKey | GCMKey | CTRKey | PBKDF2Key | KWKey;
                break;
            }
            case KeyType.HMAC:
            {
                const outputHashType = args[0] as HashType.SHA_256 | HashType.SHA_384 | HashType.SHA_512;

                key = {cryptoKey, outputHashType} as HMACKey<any>;
                break;
            }
            case KeyType.HKDF:
            case KeyType.CRYPT:
            {
                const config = this._app.configUtil.get(true).classes.KeyUtil.frozen;

                const [salt, uid] = args as [salt, uid];

                key = {cryptoKey, salt, uid} as HKDFKey;
                
                if (type === KeyType.CRYPT)
                {
                    const hmacKey = await this.derive(key, config.hmacLabel_hex_128 as hex_128, KeyType.HMAC, HashType.SHA_384);
                    
                    key = {cryptoKey, salt, uid, hmacKey} as CRYPTKey;
                }

                break;
            }
        }

        Object.freeze(key);

        return key;
    }
}