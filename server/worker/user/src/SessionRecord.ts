/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Env } from './index.ts';
import { ErrorCode } from '../../../../shared/src/app/json/ErrorJSON.ts';
import { CredentialsJSON } from '../../../../shared/src/app/json/UserJSON.ts';
import { hex_256 } from '../../../../shared/src/library/utils/HashUtil.ts';
import { IApp } from '@shared/app/IApp.ts';

export enum Tables
{
    Sessions = 'Sessions'
}

export enum Keys
{
    id = 'id', //session id
    userID_FK = 'userID_FK', //user id foreign key
    expires = 'expires',  //time when this session key expires
    deleted = 'deleted' //set to 1 if the session key is "deleted", otherwise 0
}

export class SessionRecord<A extends IApp<A>>
{
    private _app:A;

    protected _env:Env;

    constructor(app:A, env:Env)
    {
        this._app = app;

        this._env = env;
    }

    public async valid(requestData:ValidRequestData):Promise<ValidResponseData | Response>
    {   
        const now = Date.now();
        if (this._env.useKVSessionImplementation)
        {
            let result:KVNamespaceGetWithMetadataResult<string, {expires:number}> = await this._env.userSessionKVDB.getWithMetadata(requestData.id);
            if (result.value !== null && result.metadata !== null) return {valid:result.metadata.expires > now, userID:result.value as hex_256};
        }

        const result = await this._env.userDB.prepare(`SELECT ${Keys.id}, ${Keys.userID_FK} FROM ${Tables.Sessions} WHERE ${Keys.id} = ?1 AND ${Keys.expires} > ?2 AND ${Keys.deleted} = ?3`).bind(requestData.id, now, 0).all();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error selecting from database'});
        
        const data:Record<string, any> = result?.results?.length ? result.results[0] as Record<string, any> : {};

        return {valid:result?.results?.length === 1, userID:data[Keys.userID_FK]};
    }

    public async delete(requestData:DeleteRequestData):Promise<DeleteResponseData | Response>
    {
        if (this._env.useKVSessionImplementation) await this._env.userSessionKVDB.delete(requestData.id);
 
        const result = await this._app.sqlUtil.createUpdateStatement(this._env.userDB, Tables.Sessions, [Keys.id, requestData.id], [[Keys.deleted, 1]]).run();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error deleting in database'});
        
        return {};
    }

    public async deleteAll(requestData:DeleteAllRequestData):Promise<DeleteAllResponseData | Response>
    {
        if (this._env.useKVSessionImplementation) {} //not supported

        const result = await this._app.sqlUtil.createUpdateStatement(this._env.userDB, Tables.Sessions, [Keys.userID_FK, requestData.userID], [[Keys.deleted, 1]]).run();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error deleting in database'});
        
        return {};
    }

    public async create(requestData:CreateRequestData):Promise<CreateResponseData | Response>
    {
        const id = this._app.uidUtil.generate();
        const expires = Date.now() + 60 * 60 * 1000; //session token is valid for 1 hour

        if (this._env.useKVSessionImplementation) await this._env.userSessionKVDB.put(id, requestData.userID, {metadata:{expires:expires}, expiration:(expires / 1000)});
        
        const data:Array<[string, any]> = [[Keys.id, id],
                                           [Keys.userID_FK, requestData.userID], 
                                           [Keys.expires, expires],
                                           [Keys.deleted, 0]];

        const result = await this._app.sqlUtil.createInsertStatement(this._env.userDB, Tables.Sessions, data).run();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error inserting in database'});

        return {id, expires};
    }

    public async extend(requestData:ExtendRequestData):Promise<ExtendResponseData | Response>
    {
        return this.create(requestData);
    }

    public async prune(requestData:PruneRequestData):Promise<PruneResponseData | Response>
    {
        const now = requestData.millisecondsSinceUnixEpoch;
        const result = await this._env.userDB.prepare(`DELETE FROM ${Tables.Sessions} WHERE ${Keys.expires} < ?1 OR ${Keys.deleted} = ?2`).bind(now, 1).run();
        if (result.success !== true) return this._app.responseUtil.error({error:ErrorCode.USER_UNRECOVERABLE, details:'error deleting from database'});
        
        return {};
    }
}

export interface ValidRequestData
{
    id:hex_256;
}

export interface ValidResponseData
{
    valid:boolean;
    userID:hex_256;
}

export interface DeleteRequestData
{
    id:hex_256;
}

export interface DeleteResponseData
{
}

export interface DeleteAllRequestData
{
    userID:hex_256;
}

export interface DeleteAllResponseData
{
}

export interface UpdateRequestData extends CredentialsJSON
{
    attempts:number;
}

export interface UpdateResponseData
{
    id:hex_256;
}

export interface CreateRequestData
{
    userID:hex_256;
}

export interface CreateResponseData
{
    id:hex_256;
    expires:number;
}

export interface ExtendRequestData 
{
    userID:hex_256;
}

export interface ExtendResponseData extends CreateResponseData
{
}

export interface PruneRequestData
{
    millisecondsSinceUnixEpoch:number;
}

export interface PruneResponseData
{
}
