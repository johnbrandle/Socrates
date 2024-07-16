/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { hex_256 } from "../../library/utils/HashUtil";
import type { emptystring } from "../../library/utils/StringUtil";

export enum WalletCashGiftCardValue
{
    ZERO = 0, //non-gift card wallets will be set to this value
    FIVE = 5,
    TEN = 10,
    TWENTY = 20,
    FIFTY = 50,
    HUNDRED = 100
}

export interface GetRequestJSON
{
    id:hex_256;
}

export interface GetResponseJSON extends WalletJSON
{
}

export interface CreateRequestJSON
{
}

export interface CreateResponseJSON
{
    id:hex_256;
}

export interface CreateGiftRequestJSON
{
    activationValue:WalletCashGiftCardValue;
    onActivationTransferToWalletID:hex_256 | emptystring;
}

export interface CreateGiftResponseJSON
{
    activationCode:string;
    tokens:number;
}

export interface ActivateRequestJSON
{
    activationCode:string;
    activationValue:WalletCashGiftCardValue; //must match value when created
}

export interface ActivateResponseJSON
{
    tokens:number; //new token balance of wallet
}

export interface FundRequestJSON
{
    id:hex_256; //wallet id to transfer funds into
    fundValue:number; //this is not restricted like the gift values are
}

export interface FundResponseJSON
{
    tokens:number; //new token balance of wallet
}

export interface GetExchangeRateRequestJSON
{
}

export interface GetExchangeRateResponseJSON
{
    rate:number; //exchange rate (how many tokens for 1 dollar)
}

export interface SetExchangeRateRequestJSON
{
    rate:number; //exchange rate (how many tokens for 1 dollar)
}

export interface SetExchangeRateResponseJSON
{
}

export interface WalletJSON
{
    id:hex_256,
    tokens:number;
    activationCode:string;
    activationValue:WalletCashGiftCardValue;
    activationExpiration:number;
    onActivationTransferToWalletID:hex_256;
    active:boolean; 
}