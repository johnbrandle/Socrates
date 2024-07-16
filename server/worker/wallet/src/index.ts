/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ErrorCode } from '../../../../shared/src/app/json/ErrorJSON.ts';
import * as WalletJSON from '../../../../shared/src/app/json/WalletJSON.ts';
import { validateGetRequestJSON } from './validators/validateGetRequestJSON.ts';
import { validateCreateRequestJSON } from './validators/validateCreateRequestJSON.ts';
import { validateGetExchangeRateRequestJSON } from './validators/validateGetExchangeRateRequestJSON.ts';
import { validateSetExchangeRateRequestJSON } from './validators/validateSetExchangeRateRequestJSON.ts';
import { validateCreateGiftRequestJSON } from './validators/validateCreateGiftRequestJSON.ts';
import { validateActivateRequestJSON } from './validators/validateActivateRequestJSON.ts';
import { validateFundRequestJSON } from './validators/validateFundRequestJSON.ts';
import config from '../../../../shared/config.json' assert {type:"json"};
import { WalletRecord } from './WalletRecord.ts';
import { CharSet } from '../../../../shared/src/library/utils/BaseUtil.ts';
import { HashOutputFormat, HashType } from '../../../../shared/src/library/utils/HashUtil.ts';
import { DevEnvironment } from '../../../../shared/src/library/IEnvironment.ts';
import { App } from '../../shared/src/app/App.ts';

export interface Env extends CommonServiceEnv
{
    walletDB:D1Database; //for custom option and/or cloudflare
}

const environment = globalThis.environment =
{
    frozen:
    {
        isPlainTextMode:false,
        isLocalhost:false,
        config:config,
        devEnvironment:DevEnvironment.Prod,
        isDebug:false
    },
    isDevToolsOpen:false
};

const _app = new App(environment);
type A = typeof _app;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const get = async (context:RequestContext<Env>):Promise<Response> => 
{
    let requestJSON = await _app.requestUtil.extract<WalletJSON.GetRequestJSON>(context.request, validateGetRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    let walletRecord = new WalletRecord(_app, context.env);

    let walletJSON = await walletRecord.get(requestJSON);
    if (walletJSON instanceof Response) return walletJSON;

    let responseJSON:WalletJSON.GetResponseJSON = {id:walletJSON.id,
                                                   tokens:walletJSON.tokens,
                                                   activationCode:walletJSON.activationCode,
                                                   activationValue:walletJSON.activationValue,
                                                   active:walletJSON.active,
                                                   activationExpiration:walletJSON.activationExpiration,
                                                   onActivationTransferToWalletID:walletJSON.onActivationTransferToWalletID};
    return Response.json(responseJSON);
}

const create = async (context:RequestContext<Env>):Promise<Response> => 
{
    let requestJSON = await _app.requestUtil.extract<WalletJSON.CreateRequestJSON>(context.request, validateCreateRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    let walletRecord = new WalletRecord(_app, context.env);

    let walletJSON = await walletRecord.create({tokens:0, 
                                                activationValue:0, 
                                                activationCode:_app.textUtil.generate(64, {charset:CharSet.Base24}), //must put a unique value or else the db will complain. using a default length of 64 to prevent collisions
                                                active:true, 
                                                activationExpiration:Number.MAX_SAFE_INTEGER, 
                                                onActivationTransferToWalletID:''});
    if (walletJSON instanceof Response) return walletJSON;

    let responseJSON:WalletJSON.CreateResponseJSON = {id:walletJSON.id};
    return Response.json(responseJSON);
}

const createGift = async (context:RequestContext<Env>):Promise<Response> => 
{
    let requestJSON = await _app.requestUtil.extract<WalletJSON.CreateGiftRequestJSON>(context.request, validateCreateGiftRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    let walletRecord = new WalletRecord(_app, context.env);

    let exchangeRateJSON = await walletRecord.getExchangeRate({});
    if (exchangeRateJSON instanceof Response) return exchangeRateJSON;

    let dollars = requestJSON.activationValue; //they can send multiple qr codes if needed, but the possible amount values are restricted to the enum values
    let exchangeRate = exchangeRateJSON.rate;
    let tokens = Math.floor(dollars * exchangeRate);
    
    //create activation code
    let code = _app.textUtil.generate(21, {charset:CharSet.Base24}); 
    let codeHash = await _app.hashUtil.derive(_app.hashUtil.encodeData(_app.textUtil.toUint8Array(code)), HashType.SHA_256, HashOutputFormat.Hex);
    let base24Hash = _app.baseUtil.toBase24(codeHash, CharSet.Base24); //convert to the base24 charset

    const activationCode = code + base24Hash.slice(0, 4).toUpperCase(); //append checksum

    const millisecondsPerMonth = 1000 * 60 * 60 * 24 * 30; //milliseconds in a month approximation
    let activationExpiration = Date.now() + (6 * millisecondsPerMonth); //expires in approx. 6 months

    let walletJSON = await walletRecord.create({tokens:tokens, 
                                                activationValue:dollars, 
                                                activationCode:activationCode, 
                                                active:false, 
                                                activationExpiration:activationExpiration, 
                                                onActivationTransferToWalletID:requestJSON.onActivationTransferToWalletID});
    if (walletJSON instanceof Response) return walletJSON;

    let responseJSON:WalletJSON.CreateGiftResponseJSON = {activationCode:activationCode, tokens:tokens};
    return Response.json(responseJSON);
}

const getExchangeRate = async (context:RequestContext<Env>):Promise<Response> => 
{
    let requestJSON = await _app.requestUtil.extract<WalletJSON.GetExchangeRateRequestJSON>(context.request, validateGetExchangeRateRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    let walletRecord = new WalletRecord(_app, context.env);
    
    let exchangeRateJSON = await walletRecord.getExchangeRate({});
    if (exchangeRateJSON instanceof Response) return exchangeRateJSON;

    let responseJSON:WalletJSON.GetExchangeRateResponseJSON = {rate:exchangeRateJSON.rate};
    return Response.json(responseJSON);
}

const transfer = async (context:RequestContext<Env>):Promise<Response> => 
{
    //transfering in or out of the global wallet requires admin rights

    throw new Error('transfer funds from one wallet to another given two valid ids');
}

////////////admin methods

const _setExchangeRate = async (context:RequestContext<Env>):Promise<Response> => 
{
    let authorized = _app.requestUtil.isAuthorized(context.request, context.env);
    if (authorized instanceof Response) return authorized;

    let requestJSON = await _app.requestUtil.extract<WalletJSON.SetExchangeRateRequestJSON>(context.request, validateSetExchangeRateRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    let walletRecord = new WalletRecord(_app, context.env);
    
    let exchangeRateJSON = await walletRecord.setExchangeRate({...requestJSON});
    if (exchangeRateJSON instanceof Response) return exchangeRateJSON;

    let responseJSON:WalletJSON.SetExchangeRateResponseJSON = {};
    return Response.json(responseJSON);
}

const _activate = async (context:RequestContext<Env>):Promise<Response> => 
{
    let authorized = _app.requestUtil.isAuthorized(context.request, context.env);
    if (authorized instanceof Response) return authorized;

    let requestJSON = await _app.requestUtil.extract<WalletJSON.ActivateRequestJSON>(context.request, validateActivateRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    let walletRecord = new WalletRecord(_app, context.env);

    let walletJSON = await walletRecord.activate({activationCode:requestJSON.activationCode, activationValue:requestJSON.activationValue});
    if (walletJSON instanceof Response) return walletJSON;

    let responseJSON:WalletJSON.ActivateResponseJSON = {tokens:walletJSON.tokens};
    return Response.json(responseJSON);
}

const global = async (context:RequestContext<Env>):Promise<Response> => 
{
    let authorized = _app.requestUtil.isAuthorized(context.request, context.env);
    if (authorized instanceof Response) return authorized;

    //essentially the fund method, but using a global wallet id

    //maybe just make the next x transactions free, essentially, check if there are funds in the global wallet, if so, deduct from that wallet instead of the user's wallet
    throw new Error('this should add tokens to a global wallet, which distributes tokens somehow...basically, people can choose to donate tokens to the community');
}

const _fund = async (context:RequestContext<Env>):Promise<Response> => 
{
    let authorized = _app.requestUtil.isAuthorized(context.request, context.env);
    if (authorized instanceof Response) return authorized;

    let requestJSON = await _app.requestUtil.extract<WalletJSON.FundRequestJSON>(context.request, validateFundRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    let walletRecord = new WalletRecord(_app, context.env);

    let exchangeRateJSON = await walletRecord.getExchangeRate({});
    if (exchangeRateJSON instanceof Response) return exchangeRateJSON;

    let dollars = requestJSON.fundValue; 
    let exchangeRate = exchangeRateJSON.rate;
    let tokens = Math.floor(dollars * exchangeRate);

    let walletJSON = await walletRecord.fund({id:requestJSON.id, fundValue:requestJSON.fundValue, tokens:tokens});
    if (walletJSON instanceof Response) return walletJSON;

    let responseJSON:WalletJSON.ActivateResponseJSON = {tokens:walletJSON.tokens};
    return Response.json(responseJSON);
}

export default 
{
	async fetch(request:Request, env:Env, cxt:ExecutionContext):Promise<Response> 
    {
        let response:Response;

        try
        {
            let [pathname, context] = await _app.requestUtil.validateProxied(request, request.headers.get('cf-connecting-ip') || '', env, cxt, config);
            if (pathname instanceof Response) return _app.responseUtil.setProxyHeaders(request, env, config, pathname);

            const wallet = config.global.api.endpoints.wallet;
            switch (pathname)
            {
                case wallet.ping:
                    response = Response.json({pong:true});
                    break;
                case wallet.get:
                    response = await get(context); 
                    break;
                case wallet.create.standard:
                    response = await create(context);
                    break;
                case wallet.create.gift:
                    response = await createGift(context);      
                    break;
                case wallet.create._activate:
                    response = await _activate(context);
                    break;
                case wallet.exchangeRate.get:
                    response = await getExchangeRate(context);
                    break;
                case wallet.exchangeRate._set:
                    response = await _setExchangeRate(context);
                    break;
                case wallet._fund:
                    response = await _fund(context);
                    break;
                default:
                    response = _app.responseUtil.error({error:ErrorCode.GLOBAL_UNSUPPORTED_COMMAND, details:'command is incorrect: ' + pathname});
            }
        }
        catch(error)
        {
            response = _app.responseUtil.error({error:ErrorCode.GLOBAL_INVALID_REQUEST, details:'request failed for an unknown reason'}, error);
        }

        return _app.responseUtil.setProxyHeaders(request, env, config, response);
	}
}