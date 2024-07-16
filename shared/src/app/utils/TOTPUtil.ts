/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { CharSet } from "../../library/utils/BaseUtil.ts";
import { SealedDecorator } from "../../library/decorators/SealedDecorator.ts";
import { KeyType, HMACKey } from "../../library/utils/KeyUtil.ts";
import { HashType } from "../../library/utils/HashUtil.ts";
import { IBaseApp } from "../../library/IBaseApp.ts";

const DIGITS_POWER = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000]; //powers of 10 used for modulo operation in TOTP generation
const WINDOW_SIZE = 2;  //this allows for 1 minute of skew either way.
const SECRET_LENGTH = 21; //length of TOTP secret
const TOTP_DIGITS = 8; //number of TOTP digits

export type totpsecret = string & {_brand:'TOTPS'};
export type totp = string & {_brand:'TOTP'};

@SealedDecorator()
export class TOTPUtil<A extends IBaseApp<A>> 
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Generate a random base25 string of length 16
     */
    public generateSecret = ():totpsecret => this._app.textUtil.generate(SECRET_LENGTH, {charset:CharSet.Base24}) as totpsecret;
    
    /**
     * Derives a TOTP given a base25 secret and a timestamp
     */
    public async derive(secret:totpsecret, time:number):Promise<totp> 
    {
        if (secret.length !== SECRET_LENGTH) throw new Error('Invalid totp secret');

        const secretBuffer = this._app.textUtil.toUint8Array(secret);
        
        const hmacKey = {cryptoKey:await crypto.subtle.importKey('raw', secretBuffer, {name:KeyType.HMAC, hash:{name:HashType.SHA_1}}, false, ['sign']), outputHashType:HashType.SHA_1} as HMACKey<HashType.SHA_1>;

        return this.#derive(hmacKey, time);
    }

    /**
     * Verify a user-provided TOTP against a secret and a timestamp
     */
    public async verify(totp:totp, secret:totpsecret, time:number):Promise<boolean> 
    {
        if (!/^\d{8}$/.test(totp)) throw new Error('invalid totp'); //check if userInput is a valid 8-digit number
        if (secret.length !== SECRET_LENGTH) throw new Error('Invalid totp secret');
        
        const secretBuffer = this._app.textUtil.toUint8Array(secret);
        const hmacKey = {cryptoKey:await crypto.subtle.importKey('raw', secretBuffer, {name:KeyType.HMAC, hash:{name:HashType.SHA_1}}, false, ['sign']), outputHashType:HashType.SHA_1} as HMACKey<HashType.SHA_1>;

        //not returning early to minimize the risk of timing attacks
        for (let i = -WINDOW_SIZE; i <= WINDOW_SIZE; i++) 
        {
            const generatedOTP = await this.#derive(hmacKey, time + i * 30);
            if (this._app.hashUtil.verify(generatedOTP, totp) === true) return true;
        }

        return false;
    }

    async #derive(hmacKey:HMACKey<HashType.SHA_1>, time:number):Promise<totp>
    {
        const timeBuffer = new ArrayBuffer(8);
        new DataView(timeBuffer).setUint32(4, Math.floor(time / 30), false);
    
        const hashBuffer = await crypto.subtle.sign('HMAC', hmacKey.cryptoKey, this._app.hmacUtil.derivePAE([new Uint8Array(timeBuffer)]));
        const hash = new Uint8Array(hashBuffer);
    
        const offset = hash[hash.length - 1] & 0xf;
    
        const binaryCode = (hash[offset] & 0x7f) << 24 | (hash[offset + 1] & 0xff) << 16 | (hash[offset + 2] & 0xff) << 8 | (hash[offset + 3] & 0xff);
    
        const otp = binaryCode % DIGITS_POWER[TOTP_DIGITS];
    
        return otp.toString().padStart(TOTP_DIGITS, '0') as totp;
    }
}