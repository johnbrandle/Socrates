/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { App } from '../../shared/src/app/App.ts';
import { ErrorCode } from '../../../../shared/src/app/json/ErrorJSON.ts';
import * as UserJSON from '../../../../shared/src/app/json/UserJSON.ts';
import { validateLoginRequestJSON } from './validators/validateLoginRequestJSON.ts';
import { validateRegisterRequestJSON } from './validators/validateRegisterRequestJSON.ts';
import { validateSessionCreateRequestJSON } from './validators/validateSessionCreateRequestJSON.ts';
import { validateSessionExtendRequestJSON } from './validators/validateSessionExtendRequestJSON.ts';
import { validateSessionResumeRequestJSON } from './validators/validateSessionResumeRequestJSON.ts';
import config from '../../../../shared/config.json' assert {type: "json"};
import { UserRecord } from './UserRecord.ts';
import { KeyType } from '../../../../shared/src/library/utils/KeyUtil.ts';
import { totpsecret } from '../../../../shared/src/app/utils/TOTPUtil.ts';
import { SessionRecord } from './SessionRecord.ts';
import { DevEnvironment } from '../../../../shared/src/library/IEnvironment.ts';
import { CRYPT } from '../../../../shared/src/library/utils/CryptUtil.ts';
import { HashOutputFormat, HashType, hex_128 } from '../../../../shared/src/library/utils/HashUtil.ts';
import { HMACOutputFormat } from '../../../../shared/src/library/utils/HMACUtil.ts';

export interface Env extends CommonServiceEnv
{
    userDB:D1Database; //for custom option and/or cloudflare

    useKVSessionImplementation:boolean; //cloudflare only. use a KV implementation for sessions. set to false for custom option
    userSessionKVDB:KVNamespace; //cloudflare only. for session kv storage

    pepper:hex_128; //used for key derivation

    wallet:ServiceWorkerGlobalScope; //wallet service binding
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
const A = typeof _app;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const login = async (context:RequestContext<Env>):Promise<Response> => 
{
    const requestJSON = await _app.requestUtil.extract<UserJSON.LoginRequestJSON>(context.request, validateLoginRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    const userRecord = new UserRecord(_app, context.env);
    
    //create an hkdf key from the user's public key
    const hkdfKey = await _app.keyUtil.import(requestJSON.key, KeyType.HKDF);

    //derive an hmac key from the hkdf key
    const hmacKey = await _app.keyUtil.derive(hkdfKey, context.env.pepper, KeyType.HMAC, HashType.SHA_512);
    if (hmacKey === undefined) return _app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'can not derive hmac key'});

    //hash the user's key to use as their key
    const hashedKey = await _app.hmacUtil.derive(hmacKey, _app.hmacUtil.derivePAE([_app.baseUtil.fromHex(requestJSON.key)]), HMACOutputFormat.hex);

    //set the key to the hashed key
    requestJSON.key = hashedKey;

    //get the user record using the hashed key
    const getJSON = await userRecord.get(requestJSON);
    if (getJSON instanceof Response) return getJSON;

    //derive the crypt key, using the hashed key as the salt
    const cryptKey = await _app.keyUtil.derive(hkdfKey, hashedKey, KeyType.CRYPT);

    const encryptedTOTPSecret = _app.baseUtil.fromBase64<CRYPT<Uint8Array>>(getJSON.encryptedTOTPSecret);
    const decryptedTOTPSecret = await _app.cryptUtil.decrypt(cryptKey, encryptedTOTPSecret);
    if (decryptedTOTPSecret === undefined) return _app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'can not decrypt totp secret'});

    const totpSecretString = _app.textUtil.fromUint8Array<totpsecret>(decryptedTOTPSecret);

    const valid = await _app.totpUtil.verify(requestJSON.totp, totpSecretString, Math.floor(Date.now() / 1000));
    if (valid !== true)
    {
        const attemptsJSON = await userRecord.incrementAttempts({id:getJSON.id}); //increment login attempts
        if (attemptsJSON instanceof Response) return attemptsJSON;

        if (DevEnvironment.Dev !== context.env.environment) return _app.responseUtil.error({error:ErrorCode.USER_CRENDENTIALS_INVALID, details:'one or more user credentials invalid'});

        console.warn('totp invalid, but allowing login in dev mode');
    }

    if (getJSON.disabled) return _app.responseUtil.error({error:ErrorCode.USER_DISABLED, details:'disabled users cannot login'});

    const attemptsJSON = await userRecord.resetAttempts({id:getJSON.id}); //resets login attempts and generates new login token
    if (attemptsJSON instanceof Response) return attemptsJSON;

    //decrypt the encrypted encrypted user data
    const encryptedEncryptedUserData = _app.baseUtil.fromBase64<CRYPT<Uint8Array>>(getJSON.encrypted);
    const decryptedEncryptedUserData = await _app.cryptUtil.decrypt(cryptKey, encryptedEncryptedUserData);
    if (decryptedEncryptedUserData === undefined) return _app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'can not decrypt encrypted user data'});

    const base64DecryptedEncryptedUserData = _app.baseUtil.toBase64(decryptedEncryptedUserData);

    const loginResponseJSON:UserJSON.LoginResponseJSON = {id:getJSON.id, attempts:getJSON.attempts, admin:getJSON.admin, loginToken:attemptsJSON.loginToken, encrypted:base64DecryptedEncryptedUserData};
    return Response.json(loginResponseJSON);
}

const register = async (context:RequestContext<Env>):Promise<Response> => 
{
    const requestJSON = await _app.requestUtil.extract<UserJSON.RegisterRequestJSON>(context.request, validateRegisterRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    const userRecord = new UserRecord(_app, context.env);

    //create an hkdf key from the user's public key
    const hkdfKey = await _app.keyUtil.import(requestJSON.key, KeyType.HKDF);

    //derive an hmac key from the hkdf key
    const hmacKey = await _app.keyUtil.derive(hkdfKey, context.env.pepper, KeyType.HMAC, HashType.SHA_512);
    if (hmacKey === undefined) return _app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'can not derive hmac key'});

    //hash the user's key to use as their key
    const hashedKey = await _app.hmacUtil.derive(hmacKey, _app.hmacUtil.derivePAE([_app.baseUtil.fromHex(requestJSON.key)]), HMACOutputFormat.hex);

    //set the key to the hashed key
    requestJSON.key = hashedKey;

    //check if the user already exists
    const existsJSON = await userRecord.exists(requestJSON);
    if (existsJSON instanceof Response) return existsJSON;
    if (existsJSON.exists) return _app.responseUtil.error({error:ErrorCode.USER_EXISTS, details:'user already exists'});

    //verify the totp
    const passed = await _app.totpUtil.verify(requestJSON.totp, requestJSON.totpSecret, Math.floor(Date.now() / 1000));
    if (passed !== true) 
    {
        if (DevEnvironment.Dev !== context.env.environment) return _app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'totp verification failed'});

        console.warn('totp verification failed, but we are in dev mode so no problem');
    }

    //derive the crypt key, using the hashed key as the salt
    const cryptKey = await _app.keyUtil.derive(hkdfKey, hashedKey, KeyType.CRYPT);

    //encrypt the totp secret then base64 it for storage
    const encryptedTOTPSecret = await _app.cryptUtil.encrypt(cryptKey, _app.textUtil.toUint8Array(requestJSON.totpSecret));
    if (encryptedTOTPSecret === undefined) return _app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'can not encrypt totp secret'});

    const encryptedTOTPSecretBase64 = _app.baseUtil.toBase64(encryptedTOTPSecret);

    //encrypt the user's encrypted data (using the pepper). this way if there is a db breach, the encrypted data cannot be used without the pepper
    //so an attacker would still have to resort to client-to-server brute force attacks rather than just attacking the db data directly
    const encryptedEncryptedUserData = await _app.cryptUtil.encrypt(cryptKey, _app.baseUtil.fromBase64(requestJSON.encrypted));
    if (encryptedEncryptedUserData === undefined) return _app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'can not encrypt encrypted user data'});

    const base64EncryptedEncryptedUserData = _app.baseUtil.toBase64(encryptedEncryptedUserData);

    //create the user record with the hashed key and encrypted totp secret
    const createJSON = await userRecord.create({key:hashedKey, encryptedTOTPSecret:encryptedTOTPSecretBase64, disabled:false, admin:false, encrypted:base64EncryptedEncryptedUserData});
    if (createJSON instanceof Response) return createJSON;

    //send the user their id and login token
    const registerResponseJSON:UserJSON.RegisterResponseJSON = {id:createJSON.id, attempts:0, admin:false, loginToken:createJSON.loginToken};
    return Response.json(registerResponseJSON);
}

const updateTOTP = async (context:RequestContext<Env>):Promise<Response> => 
{
    throw new Error('Todo');
}

const updatePassword = async (context:RequestContext<Env>):Promise<Response> => 
{
    throw new Error('Todo');
}

const sessionCreate = async (context:RequestContext<Env>):Promise<Response> => 
{
    const requestJSON = await _app.requestUtil.extract<UserJSON.SessionCreateRequestJSON>(context.request, validateSessionCreateRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    const userRecord = new UserRecord(_app, context.env);

    const getJSON = await userRecord.get({id:requestJSON.userID});
    if (getJSON instanceof Response) return getJSON;

    if (_app.hashUtil.verify(getJSON.loginToken, await _app.hashUtil.derive(_app.hashUtil.encodeData(requestJSON.loginToken), HashType.SHA_256, HashOutputFormat.hex)) === false) return _app.responseUtil.error({error:ErrorCode.SESSION_LOGIN_TOKEN_INVALID, details:'login token invalid'});

    const resetLoginTokenJSON = await userRecord.resetLoginToken({id:getJSON.id}); //generates new login token
    if (resetLoginTokenJSON instanceof Response) return resetLoginTokenJSON;

    const sessionRecord = new SessionRecord(_app, context.env);

    const createJSON = await sessionRecord.create(requestJSON);
    if (createJSON instanceof Response) return createJSON;
    
    const responseJSON:UserJSON.SessionExtendResponseJSON = {id:createJSON.id, expires:createJSON.expires};
    return Response.json(responseJSON);
}

const sessionExtend = async (context:RequestContext<Env>):Promise<Response> => 
{
    const requestJSON = await _app.requestUtil.extract<UserJSON.SessionExtendRequestJSON>(context.request, validateSessionExtendRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    const sessionRecord = new SessionRecord(_app, context.env);

    const validJSON = await sessionRecord.valid(requestJSON);
    if (validJSON instanceof Response) return validJSON;
    if (!validJSON.valid) return _app.responseUtil.error({error:ErrorCode.USER_SESSION_INVALID, details:'user session invalid'});

    const extendJSON = await sessionRecord.extend(requestJSON);
    if (extendJSON instanceof Response) return extendJSON;

    const responseJSON:UserJSON.SessionExtendResponseJSON = {id:extendJSON.id, expires:extendJSON.expires};
    return Response.json(responseJSON);
}

const sessionResume = async (context:RequestContext<Env>):Promise<Response> => 
{
    const requestJSON = await _app.requestUtil.extract<UserJSON.SessionResumeRequestJSON>(context.request, validateSessionResumeRequestJSON);
    if (requestJSON instanceof Response) return requestJSON;

    const sessionRecord = new SessionRecord(_app, context.env);

    const validJSON = await sessionRecord.valid(requestJSON);
    if (validJSON instanceof Response) return validJSON;
    if (!validJSON.valid) return _app.responseUtil.error({error:ErrorCode.USER_SESSION_INVALID, details:'user session invalid'});

    const extendJSON = await sessionRecord.extend(requestJSON);
    if (extendJSON instanceof Response) return extendJSON;

    const userRecord = new UserRecord(_app, context.env);
    
    const getJSON = await userRecord.get({id:requestJSON.userID});
    if (getJSON instanceof Response) return getJSON;

    const loginResponseJSON:UserJSON.SessionResumeResponseJSON = {sessionID:extendJSON.id, expires:extendJSON.expires, id:getJSON.id, attempts:0, admin:getJSON.admin};
    return Response.json(loginResponseJSON);
}

export default 
{
	async fetch(request:Request, env:Env, cxt:ExecutionContext):Promise<Response> 
    {
        let response:Response;

        try
        {
            const [pathname, context] = await _app.requestUtil.validateProxied(request, request.headers.get('cf-connecting-ip') || '', env, cxt, config);
            if (pathname instanceof Response) return _app.responseUtil.setProxyHeaders(request, env, config, pathname);

            const user = config.global.api.endpoints.user;
            switch (pathname)
            {
                case user.ping:
                    response = Response.json({pong:true});
                    break;
                case user.login:
                    response = await login(context);
                    break;
                case user.register:
                    response = await register(context); 
                    break;
                case user.update.totp:
                    response = await updateTOTP(context);
                    break;
                case user.update.password:
                    response = await updatePassword(context);
                    break;
                case user.session.create:
                    response = await sessionCreate(context);
                    break;
                case user.session.extend:
                    response = await sessionExtend(context);
                    break;
                case user.session.resume:
                    response = await sessionResume(context);
                    break;   
                default:
                    response = _app.responseUtil.error({error:ErrorCode.GLOBAL_UNSUPPORTED_COMMAND, details:'command is incorrect: ' + pathname});
            }
        }
        catch (error)
        {
            response = _app.responseUtil.error({error:ErrorCode.GLOBAL_INVALID_REQUEST, details:'request failed for an unknown reason'}, error);
        }

        return _app.responseUtil.setProxyHeaders(request, env, config, response);
	},

    async scheduled(event:ScheduledEvent, env:Env, context:ExecutionContext) //CLOUDFLARE_SPECIFIC - removes old session rows (basically a chron job)
    {
        context.waitUntil((async ():Promise<any> => 
        {
            await new SessionRecord(_app, env).prune({millisecondsSinceUnixEpoch:event.scheduledTime});
        })());
    }
}