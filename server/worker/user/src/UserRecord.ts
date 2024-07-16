/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Env } from './index.ts';
import { ErrorCode } from '../../../../shared/src/app/json/ErrorJSON.ts';
import { HashOutputFormat, HashType, hex_256, hex_512 } from '../../../../shared/src/library/utils/HashUtil.ts';
import { base64 } from '../../../../shared/src/library/utils/BaseUtil.ts';
import { UserJSON } from '../../../../shared/src/app/json/UserJSON.ts';
import { IApp } from '../../shared/src/app/IApp.ts';

export enum Tables
{
    Users = 'Users',
}

export enum Keys //these key values are tied to the db, so be careful
{
    id = 'id', //user id (never changes)
    key = 'key', //user key (hashed) (value can be changed by user)
    encryptedTOTPSecret = 'encryptedTOTPSecret', //the shared totp secret
    attempts = 'attempts', //how many login attempts have there been since last login?
    disabled = 'disabled', //set to 1 if a user cannot login, otherwise 0 (this is meant to be permanent, for certain accounts such as "bank")
    admin = 'admin', //set to 1 if the user has admin access, otherwise 0
    loginToken = 'loginToken', //a one-time use token (hashed) that is generated during login or registration. used to create a session
    encrypted = 'encrypted', //user encrypted data
}

export class UserRecord<A extends IApp<A>>
{
    protected _app:A;
    protected _env:Env;

    static _once:boolean = false;

    constructor(app:A, env:Env)
    {
        this._app = app;

        this._env = env;
    }

    public async get(requestData:GetRequestData):Promise<GetResponseData | Response>
    {
        let result:D1Result<unknown>;

        if (requestData.id) result = await this._env.userDB.prepare(`SELECT * FROM ${Tables.Users} WHERE ${Keys.id} = ?1`).bind(requestData.id).all();
        else if (requestData.key)
        {
            const key = await this.hashHexString(requestData.key); //the key is hashed in the db, so we need to hash it here to compare
            result = await this._env.userDB.prepare(`SELECT * FROM ${Tables.Users} WHERE ${Keys.key} = ?1`).bind(key).all();
        }
        else return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'invalid request data'});

        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error selecting from database'});
        if (result.results?.length !== 1) return this._app.responseUtil.error({error:ErrorCode.USER_NOT_FOUND, details:'user not found'});

        const data:Record<string, any> = result.results[0]!;
                
        return {[Keys.id]:data[Keys.id], 
                [Keys.encryptedTOTPSecret]:data[Keys.encryptedTOTPSecret], 
                [Keys.attempts]:data[Keys.attempts], 
                [Keys.disabled]:data[Keys.disabled] === 1, 
                [Keys.admin]:data[Keys.admin] === 1, 
                [Keys.loginToken]:data[Keys.loginToken],
                [Keys.encrypted]:data[Keys.encrypted]};
    }

    public async exists(requestData:ExistsRequestData):Promise<ExistsResponseData | Response>
    {
        let result:D1Result<unknown>;

        if (requestData.id) result = await this._env.userDB.prepare(`SELECT ${Keys.id} FROM ${Tables.Users} WHERE ${Keys.id} = ?1`).bind(requestData.id).all();
        else
        {
            const key = await this.hashHexString(requestData.key); //the key is hashed in the db, so we need to hash it here to compare
            result = await this._env.userDB.prepare(`SELECT ${Keys.key} FROM ${Tables.Users} WHERE ${Keys.key} = ?1`).bind(key).all();
        }

        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error selecting from database'});
        
        return {exists:result?.results?.length === 1};
    }

    public async delete(requestData:DeleteRequestData):Promise<DeleteResponseData | Response>
    {
        const id = await this.hashHexString(requestData.id);

        const result = await this._app.sqlUtil.createDeleteStatement(this._env.userDB, Tables.Users, [Keys.id, id]).run();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error deleting in database'});
        
        return {};
    }

    public async create(requestData:CreateRequestData):Promise<CreateResponseData | Response>
    {
        const id = await this.hashHexString(requestData.key);
        const loginToken = this._app.uidUtil.generate();

        const data:Array<[string, any]> = [[Keys.id, id], //this primary key value never changes
                                          [Keys.key, requestData.key], 
                                          [Keys.encryptedTOTPSecret, requestData.encryptedTOTPSecret], 
                                          [Keys.attempts, 0],
                                          [Keys.disabled, requestData.disabled ? 1 : 0],
                                          [Keys.admin, requestData.admin ? 1 : 0],
                                          [Keys.loginToken, await this.hashHexString(loginToken)],
                                          [Keys.encrypted, requestData.encrypted]];

        const result = await this._app.sqlUtil.createInsertStatement(this._env.userDB, Tables.Users, data).run();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error inserting in database'});

        return {id, loginToken};
    }

    public async update(requestData:UpdateRequestData):Promise<UpdateResponseData | Response>
    {
        const id = requestData.id;
       
        const data:Array<[string, any]> = [];

        const result = await this._app.sqlUtil.createUpdateStatement(this._env.userDB, Tables.Users, [Keys.id, id], data).run();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error updating database'});

        return {};
    }

    public async incrementAttempts(requestData:IncrementAttemptsRequestData):Promise<IncrementAttemptsResponseData | Response>
    {
        const result = await this._env.userDB.prepare(`UPDATE ${Tables.Users} SET ${Keys.attempts} = ${Keys.attempts} + 1 WHERE ${Keys.id} = ?1`).bind(requestData.id).all();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error incrementing login attempts'});
        
        return {};
    }

    public async resetAttempts(requestData:ResetAttemptsRequestData):Promise<ResetAttemptsResponseData | Response>
    {
        const loginToken = this._app.uidUtil.generate();

        const data:Array<[string, any]> = [[Keys.attempts, 0],
                                           [Keys.loginToken, await this.hashHexString(loginToken)]]; //hash the login token, otherwise it's plaintext in the db

        const result = await this._app.sqlUtil.createUpdateStatement(this._env.userDB, Tables.Users, [Keys.id, requestData.id], data).run();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error reseting login attempts'});

        return {loginToken};
    }

    public async resetLoginToken(requestData:ResetLoginTokenRequestData):Promise<ResetLoginTokenResponseData | Response>
    {
        const loginToken = this._app.uidUtil.generate();

        const data:Array<[string, any]> = [[Keys.loginToken, loginToken]];

        const result = await this._app.sqlUtil.createUpdateStatement(this._env.userDB, Tables.Users, [Keys.id, requestData.id], data).run();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error reseting login token'});

        return {};
    }

    private async hashHexString(data:hex_256 | hex_512):Promise<hex_256>
    {
        return this._app.hashUtil.derive(this._app.hashUtil.encodeData(data), HashType.SHA_256, HashOutputFormat.hex);
    }
}

export interface GetRequestData
{
    id?:hex_256;
    key?:hex_512;
}

export interface GetResponseData extends UserJSON
{
    id:hex_256,
    encryptedTOTPSecret:base64,
    disabled:boolean,
    admin:boolean
    loginToken:hex_256;
    encrypted:base64;
}

export interface ExistsRequestData
{
    id?:hex_256;
    key:hex_512;
}

export interface ExistsResponseData
{
    exists:boolean;
}

export interface DeleteRequestData
{
    id:hex_256;
}

export interface DeleteResponseData
{
}

export interface CreateRequestData
{
    key:hex_512;
    encryptedTOTPSecret:base64;
    disabled:boolean;
    admin:boolean;
    encrypted:base64;
}

export interface CreateResponseData
{
    id:hex_256;
    loginToken:hex_256;
}

export interface UpdateRequestData
{
    id:hex_256,
}

export interface UpdateResponseData
{
}

export interface IncrementAttemptsRequestData
{
    id:hex_256;
}

export interface IncrementAttemptsResponseData
{
}

export interface ResetAttemptsRequestData
{
    id:hex_256;
}

export interface ResetAttemptsResponseData
{
    loginToken:hex_256;
}

export interface ResetLoginTokenRequestData
{
    id:hex_256;
}

export interface ResetLoginTokenResponseData
{
}