/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../../../../../shared/src/library/decorators/ImplementsDecorator";
import { SealedDecorator } from "../../../../../shared/src/library/decorators/SealedDecorator";
import { IError } from "../../../../../shared/src/library/error/IError";
import { IEnvironment } from "../../../../../shared/src/library/IEnvironment";
import { IObservableManager } from "../../../../../shared/src/library/managers/IObservableManager";
import { ArrayUtil } from "../../../../../shared/src/library/utils/ArrayUtil";
import { BaseUtil } from "../../../../../shared/src/library/utils/BaseUtil";
import { BigIntUtil } from "../../../../../shared/src/library/utils/BigIntUtil";
import { BitmaskUtil } from "../../../../../shared/src/library/utils/BitmaskUtil";
import { BitUtil } from "../../../../../shared/src/library/utils/BitUtil";
import { ByteUtil } from "../../../../../shared/src/library/utils/ByteUtil";
import { ConfigUtil } from "../../../../../shared/src/library/utils/ConfigUtil";
import { ConsoleUtil } from "../../../../../shared/src/library/utils/ConsoleUtil";
import { CryptUtil } from "../../../../../shared/src/library/utils/CryptUtil";
import { CSPUtil } from "../../../../../shared/src/library/utils/CSPUtil";
import { DebugUtil } from "../../../../../shared/src/library/utils/DebugUtil";
import { GCUtil } from "../../../../../shared/src/library/utils/GCUtil";
import { HashUtil } from "../../../../../shared/src/library/utils/HashUtil";
import { HMACUtil } from "../../../../../shared/src/library/utils/HMACUtil";
import { IntegerUtil } from "../../../../../shared/src/library/utils/IntegerUtil";
import { JSONUtil } from "../../../../../shared/src/library/utils/JSONUtil";
import { KeyUtil } from "../../../../../shared/src/library/utils/KeyUtil";
import { NumberUtil } from "../../../../../shared/src/library/utils/NumberUtil";
import { ObjectUtil } from "../../../../../shared/src/library/utils/ObjectUtil";
import { PromiseUtil } from "../../../../../shared/src/library/utils/PromiseUtil";
import { ProxyUtil } from "../../../../../shared/src/library/utils/ProxyUtil";
import { SerializationUtil } from "../../../../../shared/src/library/utils/SerializationUtil";
import { StreamUtil } from "../../../../../shared/src/library/utils/StreamUtil";
import { StringUtil } from "../../../../../shared/src/library/utils/StringUtil";
import { TextUtil } from "../../../../../shared/src/library/utils/TextUtil";
import { TypeUtil } from "../../../../../shared/src/library/utils/TypeUtil";
import { uid, UIDUtil } from "../../../../../shared/src/library/utils/UIDUtil";
import { URLUtil } from "../../../../../shared/src/library/utils/URLUtil";
import { UUIDUtil } from "../../../../../shared/src/library/utils/UUIDUtil";
import { APIUtil } from "../../../../../shared/src/app/utils/APIUtil";
import { TOTPUtil } from "../../../../../shared/src/app/utils/TOTPUtil";
import { UploadUtil } from "../../../../../shared/src/app/utils/UploadUtil";
import { RequestUtil } from "../../../../shared/src/utils/RequestUtil";
import { ResponseUtil } from "../../../../shared/src/utils/ResponseUtil";
import { BaseApp } from "../../../../shared/src/library/BaseApp";
import { SQLUtil } from "../library/utils/SQLUtil";
import { ValidatorUtil } from "../library/utils/ValidatorUtil";
import { DurableObjectUtil } from "../library/utils/cloudflare/DurableObjectUtil";
import { IApp, IAppType } from "./IApp";

/**
 * @verifyInterfacesTransformer_ignore
 */
@ImplementsDecorator(IAppType)
@SealedDecorator()
export class App extends BaseApp<App> implements IApp<App>
{   
    #_arrayUtil:ArrayUtil<App> | undefined;
    public get arrayUtil():ArrayUtil<App> { return this.#_arrayUtil ??= new ArrayUtil<App>(this); }

    #_baseUtil:BaseUtil<App> | undefined;
    public get baseUtil():BaseUtil<App> { return this.#_baseUtil ??= new BaseUtil<App>(this); }

    #_bigIntUtil:BigIntUtil<App> | undefined;
    public get bigIntUtil():BigIntUtil<App> { return this.#_bigIntUtil ??= new BigIntUtil<App>(this); }

    #_bitmaskUtil:BitmaskUtil<App> | undefined;
    public get bitmaskUtil():BitmaskUtil<App> { return this.#_bitmaskUtil ??= new BitmaskUtil<App>(this); }

    #_bitUtil:BitUtil<App> | undefined;
    public get bitUtil():BitUtil<App> { return this.#_bitUtil ??= new BitUtil<App>(this); }

    #_byteUtil:ByteUtil<App> | undefined;
    public get byteUtil():ByteUtil<App> { return this.#_byteUtil ??= new ByteUtil<App>(this); }

    #_configUtil:ConfigUtil<App> | undefined;
    public get configUtil():ConfigUtil<App> { return this.#_configUtil ??= new ConfigUtil<App>(this); }

    #_consoleUtil:ConsoleUtil<App> | undefined;
    public get consoleUtil():ConsoleUtil<App> { return this.#_consoleUtil ??= new ConsoleUtil<App>(this, 'APP SERVER'); }

    #_cryptUtil:CryptUtil<App> | undefined;
    public get cryptUtil():CryptUtil<App> { return this.#_cryptUtil ??= new CryptUtil<App>(this); }

    #_cspUtil:CSPUtil<App> | undefined;
    public get cspUtil():CSPUtil<App> { return this.#_cspUtil ??= new CSPUtil<App>(this); }

    #_dateUtil:DebugUtil<App> | undefined;
    public get debugUtil():DebugUtil<App> { return this.#_dateUtil ??= new DebugUtil<App>(this); }

    #_gcUtil:GCUtil<App> | undefined;
    public get gcUtil():GCUtil<App> { return this.#_gcUtil ??= new GCUtil<App>(this); }

    #_hashUtil:HashUtil<App> | undefined;
    public get hashUtil():HashUtil<App> { return this.#_hashUtil ??= new HashUtil<App>(this); }

    #_hmacUtil:HMACUtil<App> | undefined;
    public get hmacUtil():HMACUtil<App> { return this.#_hmacUtil ??= new HMACUtil<App>(this); }

    #_integerUtil:IntegerUtil<App> | undefined;
    public get integerUtil():IntegerUtil<App> { return this.#_integerUtil ??= new IntegerUtil<App>(this); }

    #_jsonUtil:JSONUtil<App> | undefined;
    public get jsonUtil():JSONUtil<App> { return this.#_jsonUtil ??= new JSONUtil<App>(this); }

    #_keyUtil:KeyUtil<App> | undefined;
    public get keyUtil():KeyUtil<App> { return this.#_keyUtil ??= new KeyUtil<App>(this); }

    #_numberUtil:NumberUtil<App> | undefined;
    public get numberUtil():NumberUtil<App> { return this.#_numberUtil ??= new NumberUtil<App>(this); }

    #_objectUtil:ObjectUtil<App> | undefined;
    public get objectUtil():ObjectUtil<App> { return this.#_objectUtil ??= new ObjectUtil<App>(this); }

    #_promiseUtil:PromiseUtil<App> | undefined;
    public get promiseUtil():PromiseUtil<App> { return this.#_promiseUtil ??= new PromiseUtil<App>(this); }

    #_proxyUtil:ProxyUtil<App> | undefined;
    public get proxyUtil():ProxyUtil<App> { return this.#_proxyUtil ??= new ProxyUtil<App>(this); }

    #_requestUtil:RequestUtil<App> | undefined;
    public get requestUtil():RequestUtil<App> { return this.#_requestUtil ??= new RequestUtil<App>(this); }

    #_responseUtil:ResponseUtil<App> | undefined;
    public get responseUtil():ResponseUtil<App> { return this.#_responseUtil ??= new ResponseUtil<App>(this); }

    #_serializationUtil:SerializationUtil<App> | undefined;
    public get serializationUtil():SerializationUtil<App> { return this.#_serializationUtil ??= new SerializationUtil<App>(this); }

    #_streamUtil:StreamUtil<App> | undefined;
    public get streamUtil():StreamUtil<App> { return this.#_streamUtil ??= new StreamUtil<App>(this); }

    #_stringUtil:StringUtil<App> | undefined;
    public get stringUtil():StringUtil<App> { return this.#_stringUtil ??= new StringUtil<App>(this); }

    #_textUtil:TextUtil<App> | undefined;
    public get textUtil():TextUtil<App> { return this.#_textUtil ??= new TextUtil<App>(this); }

    #_typeUtil:TypeUtil<App> | undefined;
    public get typeUtil():TypeUtil<App> { return this.#_typeUtil ??= new TypeUtil<App>(this); }

    #_uidUtil:UIDUtil<App> | undefined;
    public get uidUtil():UIDUtil<App> { return this.#_uidUtil ??= new UIDUtil<App>(this); }

    #_urlUtil:URLUtil<App> | undefined;
    public get urlUtil():URLUtil<App> { return this.#_urlUtil ??= new URLUtil<App>(this); }

    #_uuidUtil:UUIDUtil<App> | undefined;
    public get uuidUtil():UUIDUtil<App> { return this.#_uuidUtil ??= new UUIDUtil<App>(this); }


    #_apiUtil:APIUtil<App> | undefined;
    public get apiUtil():APIUtil<App> { return this.#_apiUtil ??= new APIUtil<App>(this); }

    #_totpUtil:TOTPUtil<App> | undefined;
    public get totpUtil():TOTPUtil<App> { return this.#_totpUtil ??= new TOTPUtil<App>(this); }

    #_uploadUtil:UploadUtil<App> | undefined;
    public get uploadUtil():UploadUtil<App> { return this.#_uploadUtil ??= new UploadUtil<App>(this); }

    #_sqlUtil:SQLUtil<App> | undefined;
    public get sqlUtil():SQLUtil<App> { return this.#_sqlUtil ??= new SQLUtil<App>(this); }

    #_validatorUtil:ValidatorUtil<App> | undefined;
    public get validatorUtil():ValidatorUtil<App> { return this.#_validatorUtil ??= new ValidatorUtil<App>(this); }

    #_durableObjectUtil:DurableObjectUtil<App> | undefined;
    public get durableObjectUtil():DurableObjectUtil<App> { return this.#_durableObjectUtil ??= new DurableObjectUtil<App>(this); }

    public get uid():uid { return this.throw('uid not implemented', [], {correctable:true}); }

    public get observableManager():IObservableManager<App> { return this.throw('observable manager not implemented', [], {correctable:true}); }

    constructor(environment:IEnvironment) 
    {
        super(environment);
    }

    public override async init():Promise<true | IError> 
    {
        return super.init();
    }

    protected log(...data:any[]):void { this.consoleUtil.log(this.constructor, ...data); }

    public override get name() { return this.configUtil.get(true).app.name; }
}