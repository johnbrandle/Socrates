/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Env } from './index.ts';
import * as WalletJSON from '../../../../shared/src/app/json/WalletJSON.ts';
import { ErrorCode } from '../../../../shared/src/app/json/ErrorJSON.ts';
import { HashOutputFormat, HashType, hex_256 } from '../../../../shared/src/library/utils/HashUtil.ts';
import { emptystring } from '../../../../shared/src/library/utils/StringUtil.ts';
import { IApp } from '../../shared/src/app/IApp.ts';

export enum Tables
{
    Wallets = 'Wallets',
    ExchangeRate = 'ExchangeRate',
    Transactions = 'Transactions'
}

export enum Keys //these key values are tied to the db, so be careful
{
    id = 'id',
    tokens = 'tokens',
    activationValue = 'activationValue', //what was the value of this gift card before it was converted to tokens? 
    activationCode = 'activationCode',
    activationExpiration = 'activationExpiration', 
    onActivationTransferToWalletID = 'onActivationTransferToWalletID',
    active = 'active',  
    created = 'created', 
    deleted = 'deleted'
}

export enum ExchangeRateKeys //these key values are tied to the db, so be careful
{
    auto_id = 'auto_id',
    rate = 'rate'
}

export enum TransactionsKeys
{
    auto_id = 'auto_id', 
    fromWalletID = 'fromWalletID',
    toWalletID = 'toWalletID',
    tokens = 'tokens',
    value = 'value', //only applies for initial transactions and real transactions (as in someone actually paid money)
    epoch = 'epoch'
}

export class WalletRecord<A extends IApp<A>>
{
    protected _app:A;

    protected _env:Env;

    constructor(app:A, env:Env)
    {
        this._app = app;

        this._env = env;
    }

    public async get(requestData:{id:string}):Promise<(WalletJSON.WalletJSON & {created:number}) | Response>
    {
        const result = await this._env.walletDB.prepare(`SELECT * 
                                                         FROM ${Tables.Wallets} 
                                                         WHERE ${Keys.id} = ?1 
                                                         AND ${Keys.deleted} = 0`).bind(requestData.id).all();
        if (!result.success || !result.results || !result.results.length) return this._app.responseUtil.error({error:ErrorCode.WALLET_UNRECOVERABLE, details:'error selecting from database'});
           
        let data:Record<string, any> = result.results[0]!;
        
        return {[Keys.id]:data[Keys.id], 
                [Keys.tokens]:data[Keys.tokens], 
                [Keys.activationValue]:data[Keys.activationValue], 
                [Keys.activationCode]:data[Keys.activationCode], 
                [Keys.onActivationTransferToWalletID]:data[Keys.onActivationTransferToWalletID],
                [Keys.active]:data[Keys.active] === 1, 
                [Keys.activationExpiration]:data[Keys.activationExpiration], 
                [Keys.created]:data[Keys.created]};
    }

    public async create(requestData:{tokens:number, activationValue:WalletJSON.WalletCashGiftCardValue, activationCode:string, active:boolean, activationExpiration:number, onActivationTransferToWalletID:hex_256 | emptystring}):Promise<({id:hex_256})  | Response>
    {
        const id = this._app.uidUtil.generate();
        const hash = await this._app.hashUtil.derive(this._app.hashUtil.encodeData(this._app.textUtil.toUint8Array(requestData.activationCode)), HashType.SHA_256, HashOutputFormat.hex);

        const data:Array<[Keys, any]> = [
            [Keys.id, id],
            [Keys.tokens, requestData.tokens],
            [Keys.activationValue, requestData.activationValue], 
            [Keys.activationCode, hash],
            [Keys.activationExpiration, requestData.activationExpiration],
            [Keys.onActivationTransferToWalletID, requestData.onActivationTransferToWalletID],
            [Keys.active, requestData.active ? 1 : 0],
            [Keys.created, Date.now()],
            [Keys.deleted, 0],
        ];

        const result = await this._app.sqlUtil.createInsertStatement(this._env.walletDB, Tables.Wallets, data).run();
        
        if (!result.success) return this._app.responseUtil.error({error:ErrorCode.WALLET_UNRECOVERABLE, details:'error creating entry in database'});

        return {id};
    }

    public async activate(requestData:{activationCode:string, activationValue:WalletJSON.WalletCashGiftCardValue}):Promise<({tokens:number, balance:number})  | Response>
    {
        let hash = await this._app.hashUtil.derive(this._app.hashUtil.encodeData(this._app.textUtil.toUint8Array(requestData.activationCode)), HashType.SHA_256, HashOutputFormat.hex);
        let now = Date.now();

        let result1 = await this._env.walletDB.prepare(`SELECT ${Keys.id}, ${Keys.tokens}, ${Keys.active}, ${Keys.onActivationTransferToWalletID} 
                                                        FROM ${Tables.Wallets} 
                                                        WHERE ${Keys.activationCode} = ?1 
                                                        AND ${Keys.activationValue} = ?2 
                                                        AND ${Keys.deleted} = 0 
                                                        AND ${Keys.activationExpiration} > ?3`).bind(hash, requestData.activationValue, now).all();
        if (!result1.success || !result1.results || !result1.results.length) return this._app.responseUtil.error({error:ErrorCode.WALLET_UNRECOVERABLE, details:'wallet either does not exist, is deleted, expired, or there is a value mismatch'});

        let data1:Record<string, any> = result1.results[0]!;
        let id = data1[Keys.id];
        let tokens = data1[Keys.tokens];
        let active = data1[Keys.active];
        let onActivationTransferToWalletID = data1[Keys.onActivationTransferToWalletID]; //optional, wallet to transfer funds into after activation

        if (active) return {tokens:tokens, balance:tokens}; //already active, no need to update

        let data2:Array<[Keys, any]> = [[Keys.active, 1]];
        let statement1 = this._app.sqlUtil.createUpdateStatement(this._env.walletDB, Tables.Wallets, [Keys.id, id], data2);
        
        let data3:Array<[TransactionsKeys, any]> = [ //create transaction
            [TransactionsKeys.fromWalletID, ''],
            [TransactionsKeys.toWalletID, id],
            [TransactionsKeys.tokens, tokens],
            [TransactionsKeys.value, requestData.activationValue],
            [TransactionsKeys.epoch, Date.now()]
        ];
        let statement2 = this._app.sqlUtil.createInsertStatement(this._env.walletDB, Tables.Transactions, data3);
        
        let results = await this._env.walletDB.batch([statement1, statement2]);
        if (!results[0].success || !results[1].success) return this._app.responseUtil.error({error:ErrorCode.WALLET_UNRECOVERABLE, details:'error creating/updating entries in databases'});

        if (onActivationTransferToWalletID) //if this is set, try to transfer funds into wallet. if it fails, oh well. they can try manually later.
        {
            let result1 = await this._env.walletDB.prepare(`SELECT ${Keys.id}, ${Keys.tokens} 
                                                            FROM ${Tables.Wallets} 
                                                            WHERE ${Keys.id} = ?1 
                                                            AND ${Keys.deleted} = 0`).bind(onActivationTransferToWalletID).all();
            if (!result1.success || !result1.results || !result1.results.length)
            {
                this._app.consoleUtil.log(this.constructor, 'failed to transfer tokens on wallet activation 1');

                return {tokens:tokens, balance:tokens}; //not a big deal, so don't abort, just return the tokens. we tried.
            } 

            let data1:Record<string, any> = result1.results[0]!;
            let to_id = data1[Keys.id];
            let current_tokens = data1[Keys.tokens];
            
            let data2:Array<[Keys, any]> = [[Keys.tokens, current_tokens + tokens]];
            let statement1 = this._app.sqlUtil.createUpdateStatement(this._env.walletDB, Tables.Wallets, [Keys.id, to_id], data2);
            
            let data3:Array<[Keys, any]> = [[Keys.tokens, 0], [Keys.deleted, 1]];
            let statement2 = this._app.sqlUtil.createUpdateStatement(this._env.walletDB, Tables.Wallets, [Keys.id, id], data3);
            
            let data4:Array<[TransactionsKeys, any]> = [ //create transaction
                [TransactionsKeys.fromWalletID, id],
                [TransactionsKeys.toWalletID, to_id],
                [TransactionsKeys.tokens, tokens],
                [TransactionsKeys.value, 0],
                [TransactionsKeys.epoch, Date.now()]
            ];
            let statement3 = this._app.sqlUtil.createInsertStatement(this._env.walletDB, Tables.Transactions, data4);
            
            let results = await this._env.walletDB.batch([statement1, statement2, statement3]);
            if (!results[0].success || !results[1].success || !results[2].success) 
            {
                this._app.consoleUtil.log(this.constructor, 'failed to transfer tokens on wallet activation 2');

                return {tokens:tokens, balance:tokens}; //not a big deal, so don't abort, just return the tokens. we tried.   
            }

            return {tokens:tokens, balance:tokens + current_tokens};
        }

        return {tokens:tokens, balance:tokens};
    }

    public async fund(requestData:{id:string, fundValue:number, tokens:number}):Promise<({tokens:number, balance:number})  | Response>
    {     
        let result1 = await this._env.walletDB.prepare(`SELECT ${Keys.id}, ${Keys.tokens} 
                                                        FROM ${Tables.Wallets} 
                                                        WHERE ${Keys.id} = ?1 
                                                        AND ${Keys.deleted} = 0`).bind(requestData.id).all();
        if (!result1.success || !result1.results || !result1.results.length)  return this._app.responseUtil.error({error:ErrorCode.WALLET_UNRECOVERABLE, details:'wallet either does not exist, or is deleted'});
        
        let data1:Record<string, any> = result1.results[0]!;
        let to_id = data1[Keys.id];
        let current_tokens = data1[Keys.tokens];
        
        let data2:Array<[Keys, any]> = [[Keys.tokens, current_tokens + requestData.tokens]];
        let statement1 = this._app.sqlUtil.createUpdateStatement(this._env.walletDB, Tables.Wallets, [Keys.id, to_id], data2);
        
        let data3:Array<[TransactionsKeys, any]> = [ //create transaction
            [TransactionsKeys.fromWalletID, ''],
            [TransactionsKeys.toWalletID, to_id],
            [TransactionsKeys.tokens, requestData.tokens],
            [TransactionsKeys.value, requestData.fundValue],
            [TransactionsKeys.epoch, Date.now()]
        ];
        let statement2 = this._app.sqlUtil.createInsertStatement(this._env.walletDB, Tables.Transactions, data3);
        
        let results = await this._env.walletDB.batch([statement1, statement2]);
        if (!results[0].success || !results[1].success) return this._app.responseUtil.error({error:ErrorCode.WALLET_UNRECOVERABLE, details:'error creating/updating entries in databases'});
        
        return {tokens:requestData.tokens, balance:requestData.tokens + current_tokens};
    }

    public async getExchangeRate(requestData:{}):Promise<{rate:number} | Response>
    {
        const result = await this._env.walletDB.prepare(`SELECT ${ExchangeRateKeys.rate} 
                                                         FROM ${Tables.ExchangeRate} 
                                                         ORDER BY ${ExchangeRateKeys.auto_id} 
                                                         DESC LIMIT 1`).bind().all();
        if (!result.success || !result.results || !result.results.length) return this._app.responseUtil.error({error:ErrorCode.WALLET_UNRECOVERABLE, details:'error selecting exchange rate from database'});
           
        let data:Record<string, any> = result.results[0]!;
        
        return {[ExchangeRateKeys.rate]:data[ExchangeRateKeys.rate]};
    }

    public async setExchangeRate(requestData:{rate:number}):Promise<{} | Response>
    {
        let data:Array<[ExchangeRateKeys, any]> = [
            [ExchangeRateKeys.rate, requestData.rate],
        ];

        let result = await this._app.sqlUtil.createInsertStatement(this._env.walletDB, Tables.ExchangeRate, data).run();
        
        if (!result.success) return this._app.responseUtil.error({error:ErrorCode.WALLET_UNRECOVERABLE, details:'error creating entry in database'});

        return {};
    }
}