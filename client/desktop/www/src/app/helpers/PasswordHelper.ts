/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @reference https://en.wikipedia.org/wiki/Password_strength
 * @reference https://frequencylist.com/
 * @reference https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases
 * 
 * @important ALL changes to this and dependant utils must be well tested!
 */

import type { IApp } from "../IApp.ts";
import { KeyType, type CBCKey, type HKDFKey } from "../../library/utils/KeyUtil.ts";
import eff from "../../../data/words/eff.metadata.json";
import { HashOutputFormat, HashType, type EncodedHashableData, type Hex_1024, type Hex_128, type Hex_256, type Hex_512 } from "../../library/utils/HashUtil.ts";
import { ErrorJSONObject } from "../../../../../../shared/src/app/json/ErrorJSONObject.ts";
import { HMACOutputFormat, type PAE } from "../../library/utils/HMACUtil.ts";
import { CharSet } from "../../library/utils/BaseUtil.ts";
import { type uint } from "../../../../../../shared/src/library/utils/IntegerUtil.ts";
import { DevEnvironment } from "../../../../../../shared/src/library/IEnvironment.ts";
import { type IAborted } from "../../../../../../shared/src/library/abort/IAborted.ts";
import type { IError } from "../../../../../../shared/src/library/error/IError.ts";
import type { IProgressor } from "../../../../../../shared/src/library/progress/IProgressor.ts";
import { AbortableEntity } from "../../../../../../shared/src/library/entity/AbortableEntity.ts";
import { Progressor } from "../../../../../../shared/src/library/progress/Progressor.ts";
import { ResolvePromise } from "../../../../../../shared/src/library/promise/ResolvePromise.ts";

const _metadata = {eff};
type MetaData = typeof _metadata;

enum State
{
    Unloaded = 0,
    Loading = 1,
    Loaded = 2
}

//custom user passwords should conform to the restrictions and character set of one of the following types
export enum PasswordType
{
    //format: alphanumeric. must contain at least one number and one letter. no symbols. case insensitive. spaces or dashes are allowed, but are removed during preprocessing.
    Key = 'key',
    
    //format: alpha characters, and possibly symbols in the future. no numbers. case insensitive. at least one space is required. 
    Word = 'word',

    //format: any character besides whitespace characters. case sensitive.
    Char = 'char',
}

export enum HardenOutputFormat
{
    HKDFKey = 'HKDFKey',
    Hex_512 = 'Hex_512',
}

export class PasswordHelper<A extends IApp<A>> extends AbortableEntity<A>
{
    private _wordLists?:MetaData;
    private _wordListsVirtualLengthLookupMap:Map<Array<Record<string, string[]>>, number> = new Map();
    
    private _promise:ResolvePromise<void> = new ResolvePromise();
    private _state:State = State.Unloaded;
    private _config = this._app.configUtil.get(true).classes.PasswordHelper;

    constructor(app:A)
    {
        super(app);
    }

    async #load():Promise<void>
    {
        if (this._state !== State.Unloaded) return this._promise;
        this._state = State.Loading;

        await this.#pullWordLists();

        this._state = State.Loaded;
        this._promise.resolve();
    }

    async #pullWordLists():Promise<void>
    {
        const config = this._config;
        const app = this._app;

        (this._wordLists as any) = {};

        const datas:any[] = [];
        const promises = [];
        for (const name in _metadata)
        {
            const data = (_metadata as any)[name] as typeof eff;

            const parts = data.parts as uint;
            const index = app.integerUtil.generate(1 as uint, parts);

            const promise = app.networkManager.webClient.getJSON<any, string[]>(config.wordsBaseURI + data.path + `${data.name}_${index}-${parts}.min.json`, undefined, undefined, true, 3);
            
            datas.push(data);
            promises.push(promise);
        }

        const values = await Promise.all(promises);

        for (let i = datas.length; i--;) 
        {
            const value = values[i];

            if (value instanceof ErrorJSONObject) return app.throw('PasswordAssistant.#pullWordLists: Failed to load word list: ' + datas[i].name, arguments);
                
            (this._wordLists as any)[datas[i].name] = value.json;
            this._wordListsVirtualLengthLookupMap.set(datas[i].name, datas[i].length);

            const wordList = value.json;
            if (app.environment.frozen.devEnvironment !== DevEnvironment.Prod)
            {
                //check the word lists for duplicates and invalid characters
                const wordSet = new Set<string>();
                for (const word of wordList) 
                {
                    //verify that word only contains lowercase letters
                    if (/^[a-z]+$/.test(word) !== true) this._app.throw(`Invalid character found in word list: ${word}`, arguments);

                    //verify that word is not empty
                    if (app.stringUtil.isEmpty(word) === true) this._app.throw(`Empty word found in word list: ${word}`, arguments);

                    if (wordSet.has(word) === true) this._app.throw(`Duplicate word found in word list: ${word}`, arguments);
                    wordSet.add(word);
                }
            }
        }
    }

    /**
     * Generates a random password of the specified length using a standard character set.
     *
     * @param {number} [length=16] - The length of the password to generate. Defaults to 16.
     * @returns {string} - A randomly generated password.
     */
    public generateCharPassword(length:number):string
    {
        const charset = this._config.charTypePasswordCharacterSet;
        
        let count = 0;
        let maxCount = 100; //if we come anywhere near this, we need a better character set! (ideally, there will never be more than 2 tries)
        while (true)
        {
            if (count++ > maxCount) this._app.throw('PasswordAssistant.generateCharPassword: Failed to generate a password with the required character types.', arguments);

            const passwordArray = this._app.integerUtil.generate(length as uint, 0 as uint, charset.length - 1 as uint);
            const password = Array.from(passwordArray, index => charset[index]).join('');

            //first, ensure the password contains at least one symbol
            const containsSymbol = /^[0-9A-Za-z]+$/.test(password) !== true;

            //second, check if the password contains at least one uppercase and one lowercase letter
            const containsBothUpperAndLowercase = /[A-Z]/.test(password) === true && /[a-z]/.test(password) === true;

            //third check if the password contains at least one number
            const containsNumber = /[0-9]/.test(password) === true;

            //if the password has at least one symbol, one number, and contains both uppercase and lowercase letters, we are done
            if (containsSymbol !== true || containsBothUpperAndLowercase !== true || containsNumber !== true) continue;

            return password;
        }
    }

    #calculateCharPasswordEntropy(length:number):number
    {
        return Math.log2(Math.pow(this._config.charTypePasswordCharacterSet.length, length));
    }

    public generateKeyPassword(length:number):string
    {
        const charset = this._config.keyTypePasswordCharacterSet;
        
        let count = 0;
        let maxCount = 100; //if we come anywhere near this, we need a better character set! (ideally, there will never be more than 2 tries)
        while (true)
        {
            if (count++ > maxCount) this._app.throw('PasswordAssistant.generateKeyPassword: Failed to generate a password with the required character types.', arguments);

            const passwordArray = this._app.integerUtil.generate(length as uint, 0 as uint, charset.length - 1 as uint);
            const array = Array.from(passwordArray, index => charset[index]);

            const prePassword = array.join('');
            //ensure the password contains at least one number and one letter
            if (/[0-9]/.test(prePassword) !== true || /[a-zA-Z]/.test(prePassword) !== true) continue; //there needs to be at least one letter and number

            const parts = this._app.arrayUtil.distribute(array, 5);

            const strParts:string[] = [];
            parts.forEach(part => strParts.push(part.join('')));
            const password = strParts.join('-');

            return password;
        }
    }
    
    #calculateKeyPasswordEntropy(length:number):number
    {
        return Math.log2(Math.pow(this._config.keyTypePasswordCharacterSet.length, length));
    }

    public async generateWordPassword(wordCount:number, symbol:boolean):Promise<string>
    {
        await this.#load();
        
        if (this._wordLists === undefined) this._app.throw('wordlist is undefined', arguments);
        if (wordCount < 6) this._app.throw('wordCount must be at least 6', arguments);

        const wordsLists = this._wordLists;
        const wordList = wordsLists.eff;
        const wordPasswordEntropy = await this.#calculateWordPasswordEntropy(wordCount, symbol); //the entropy level we would like to achieve

        let tries = 0;
        const maxTries = 100; //if we come anywhere near this, we need a better word list! (ideally, there will never be more than 2 tries)
        const generateWordPassword = async ():Promise<string> =>
        {
            const words:string[] = [];

            for (let i = 0; i < wordCount; i++) words.push(this.#getWordFromWordList(wordList));
        
            if (symbol) words.push(this._app.textUtil.generate(1, {charset:this._config.wordTypePasswordCharacterSet}));
    
            if (tries < maxTries)
            {
                tries++;

                const passwordEntropy = Math.log2(Math.pow(26, words.join('').length)); //entropy level if all characters were random letters
                if ((passwordEntropy / 1.5) < wordPasswordEntropy) //password entropy should be at least 1.5 times the entropy level we would like to achieve
                {
                    this.warn('generateWordPassword: Entropy is too low. Regenerating password.');

                    return generateWordPassword();
                }
            }

            this._app.arrayUtil.randomize(words);

            if (symbol === false) return words.join(' ');

            //we remove any spaces before or after the symbol
            let password = '';
            let foundSymbol = false;
            for (const word of words)
            {
                if (word.length === 1 && this._config.wordTypePasswordCharacterSet.indexOf(word) !== -1)
                {
                    foundSymbol = true;
                    password += word;
                    continue;
                }
                
                if (foundSymbol === false) password += ' ';
                foundSymbol = false;

                password += word;
            }

            return password;
        }

        return generateWordPassword();
    }

    async #calculateWordPasswordEntropy(wordCount:number, symbol:boolean):Promise<number> 
    {
        await this.#load();
    
        if (this._wordLists === undefined) this._app.throw('wordlist is undefined', arguments);
    
        //calculate the entropy of the words
        const wordEntropy = Math.log2(Math.pow(this._wordLists.eff.length, wordCount));

        if (symbol === false) return wordEntropy;

        //calculate the entropy of the symbols, assuming only one symbol
        const symbolEntropy = Math.log2(this._config.wordTypePasswordCharacterSet.length);
    
        //calculate the entropy from the random placement of a single symbol
        //total positions = wordCount + 1 (beginning, between words, and end)
        const positionEntropy = Math.log2(wordCount + 1);
    
        //return the sum of word entropy, symbol entropy, and position entropy
        return wordEntropy + symbolEntropy + positionEntropy;
    }
    
    #getWordFromWordList(wordList:any):string
    {
        return wordList[this._app.integerUtil.generate(0 as uint, wordList.length - 1 as uint)];
    }

    #determinePasswordType(password:string):PasswordType
    {
        password = password.normalize('NFKC').trim();

        //word passwords have at least one space; char passwords have no spaces, but key passwords can have spaces (instead of dashes)
        const hasSpace = password.indexOf(' ') !== -1;
        if (hasSpace === true || password.indexOf('-') !== -1) //it is either a word or key password
        {
            //key passwords must have a number, while word passwords cannot.
            const hasNumber = /[0-9]/.test(password) === true;

            return hasNumber ? PasswordType.Key : PasswordType.Word;
        }

        //it is either a key or char password
        //key passwords have no symbols, and char passwords have at least one symbol
        const hasOnlyAlphaNumeric = /[^0-9A-Za-z]+$/.test(password) === true;
        return hasOnlyAlphaNumeric ? PasswordType.Key : PasswordType.Char;
    }

    #preprocessPassword(password:string):string //this helps protect against password entry error
    {
        const type = this.#determinePasswordType(password);

        password = password.normalize('NFKC').trim();

        switch (type)
        {
            case PasswordType.Key:
                //replace replace any dashes with a space, and then remove any non-single whitespace characters
                return password.replace(/-/g, ' ').replace(/\s+/g, ' ');
            case PasswordType.Word:
                //remove any non-single whitespace characters
                return password.replace(/\s+/g, ' ');
            case PasswordType.Char:
                return password;
        }
    }

    public async calculateEntropy(password:string, type:PasswordType):Promise<number>
    {
        password = this.#preprocessPassword(password);

        switch (type)
        {
            case PasswordType.Key:
                password = password.replace(/-/g, ''); //remove any dashes
                return this.#calculateKeyPasswordEntropy(password.length);
            case PasswordType.Word:
                const words = password.split(' ');

                let wordLength = 0;
                let hasSymbol = false;
                for (const word of words)
                {
                    //find the index of the symbol, if any
                    const index = word.search(/[^0-9A-Za-z\s]/);
                    
                    if (index === -1) 
                    {
                        wordLength++;
                        continue;
                    }

                    hasSymbol = true;

                    //if the symbol is at the beginning or end of the word, we need to treat it as one word
                    if (index === 0 || index === word.length - 1)
                    {
                        wordLength++;
                        continue;
                    }

                    //if the symbol is in the middle of the word, we need to treat it as two words
                    wordLength += 2;
                }

                return this.#calculateWordPasswordEntropy(wordLength, hasSymbol);
            case PasswordType.Char:
                return this.#calculateCharPasswordEntropy(password.length);
        }
    }

    /**
     * Hardens (stretches) a given password using a combination of PBKDF2 and a custom stretching algorithm. This method is designed to enhance 
     * security against brute-force attacks by being both computationally and memory-intensive. It updates a large memory buffer in a pseudo-random 
     * manner determined by derived salts.
     * 
     * @note This algorithm works within the limitations of WebCrypto. It offloads the cpu intensive part to the optimized pbkdf2 implementation, 
     * and uses a byte array for memory hardening. This implementation allows us to abort and get progress updates, which is not possible with the 
     * WebCrypto pbkdf2 implementation.
     * 
     * @note The salt must be RANDOMLY GENERATED and unique for each password. The salt should be at least 16 bytes long.
     * 
     * @note due to a firefox pbkdf2 limitation and firefox poor performance, some compromises were made. However, they should not affect security
     * in a meaningful way.
     * 
     * @param {string} password - The password to be "hardened" (stretched).
     * @param {Hex_1024} salt - The salt to use for the hardening process.
     * @param {IProgressor<A, undefined>} progressor - The progressor to use for progress updates.
     * @param {HardenOutputFormat} format - The format of the hardened password output.
     * @param {Object} [options] - The options to use for the hardening process.
     * @returns {Promise<string | undefined>} A promise that resolves to the hardened password.
     */ 
    async harden(password:string, salt:Hex_1024, progressor:IProgressor<A, undefined>, format:HardenOutputFormat.HKDFKey, options?:{rounds?:number, iterations?:number, memory?:number, log?:boolean}):Promise<[HKDFKey, {rounds:number, memory:number, iterations:number}] | IAborted | IError>;
    async harden(password:string, salt:Hex_1024, progressor:IProgressor<A, undefined>, format:HardenOutputFormat.Hex_512, options?:{rounds?:number, iterations?:number, memory?:number, log?:boolean}):Promise<[Hex_512, {rounds:number, memory:number, iterations:number}] | IAborted | IError>;
    async harden(password:string, salt:Hex_1024, progressor:IProgressor<A, undefined>, format:HardenOutputFormat, options?:{rounds?:number, iterations?:number, memory?:number, log?:boolean}):Promise<[HKDFKey | Hex_512, {rounds:number, memory:number, iterations:number}] | IAborted | IError>
    {
        try
        {
            const rounds = options?.rounds ?? this._config.rounds;
            const iterations = options?.iterations ?? this._config.iterations;
            const memory = options?.memory ?? this._config.memory;

            const _ = this.createAbortableHelper(progressor).throwIfAborted();

            const a = options?.log === true ? performance.now() : 0;
        
            //we would use webcrypto pbkdf2 deriveBits, but there is a 256 byte limit for firefox. My custom deriveBits implementation was too slow, so we use this lighter approach.
            //the goal of this method is simply to prevent our initial memory buffer from being all zeros, anything else is a bonus.
            const deriveBytes = async (cbcKey:CBCKey, iv:Hex_128, rounds:number, bytes:number, progressor:IProgressor<A, undefined>):Promise<Uint8Array | IAborted | IError> =>
            {
                try 
                {
                    const progressors = progressor.split(2);

                    let data = new Uint8Array(bytes);

                    const app = this._app;
                    for (let i = 0; i < rounds; i++)
                    {
                        //we choose cbc because it cannot be parallelized
                        data = _.value(await app.byteUtil.derive(cbcKey, iv, data));
                        
                        _.check(progressors[0].setProgress((i + 1) / rounds, undefined));

                        //hashes the entire data array to get the new iv
                        if (i + 1 < rounds) iv = _.value(await app.hashUtil.derive(data as EncodedHashableData, HashType.SHA_256, HashOutputFormat.Hex)).slice(0, 16) as Hex_128; //get the first 16 bytes of the data as the new iv

                        _.check(progressors[1].setProgress(i / rounds, undefined));
                    }

                    _.check(progressors[1].setProgress(1, undefined));

                    return data;
                }
                catch (error)
                { 
                    return this._app.warn(error, 'Failed to derive bytes, count: {}', [bytes], {names:[PasswordHelper, this.harden, deriveBytes]});
                }
            }

            //corrects for a little user error 
            password = this.#preprocessPassword(password);

            if (iterations < 2**16) this._app.throw('iterations must be at least 2^16.', [], {correctable:true});
            if (memory < 512 || memory > 2**32) this._app.throw('memory must be greater or equal to than 512 bytes, and less or equal to 2^32 bytes.', [], {correctable:true});
            if (memory % 2 !== 0) this._app.throw('memory must be a power of 2.', [], {correctable:true});
            if (rounds < 2) this._app.throw('rounds must be at least 2.', [], {correctable:true});

            const progressors = progressor.split(3);

            _.check(progressors[0].setProgress(0, undefined));

            //import the password to create a pbkdf2 key
            const pbkdf2Key = _.value(await this._app.keyUtil.import(this._app.textUtil.toUint8Array(password), KeyType.PBKDF2));
 
            //derives the bytes we will use to derive other keys and an iv
            const derivedBytes = _.value(await this._app.byteUtil.derive(pbkdf2Key, salt, 120, iterations, HashType.SHA_512)); //derive 120 bytes
 
            //extract the keys and iv from the derived bytes
            const [hmacKeyData, cbcKeyData, iv] = [derivedBytes.slice(0, 64) as Hex_512, derivedBytes.slice(64, 96) as Hex_256, derivedBytes.slice(96, 112) as Hex_128];

            //import the hmac key used to derive the final result
            const hmacKey = _.value(await this._app.keyUtil.import(hmacKeyData, KeyType.HMAC, HashType.SHA_512));

            //import the cbc key we will use to create the memory buffer
            const cbcKey = _.value(await this._app.keyUtil.import(cbcKeyData, KeyType.CBC, false));

            _.check(progressors[2].setProgress(1, undefined));

            //derives the initial memory buffer
            const memoryUint8Array = _.value(await deriveBytes(cbcKey, iv, rounds, memory, progressors[1]));
            
            let offset = 0; //initial offset will always be 0
            for (let i = 0; i < rounds; i++)
            {
                //calculate the number of bytes to use as the salt
                //we would use the full salt for each round but firefox's pbkdf2 implementation is 2x slower than chrome, reducing the salt size helps a lot
                const bytes = Math.max(Math.floor(memoryUint8Array.length / (rounds - i)), 512); //the amount of bytes will increase each round (bytes will equal memoryUint8Array.length in the last round), but we will never use less than 512 bytes
                
                //determine the segment of the memory array to use as the salt, beginning at the offset (this is where the updated bytes start from the previous round)
                const begin = offset + bytes > memoryUint8Array.length ? memoryUint8Array.length - bytes : offset;
                const salt = memoryUint8Array.subarray(begin, begin + bytes);
                
                //derive bits using pbkdf2
                const keyData = _.value(await this._app.byteUtil.derive(pbkdf2Key, salt, 64, iterations, HashType.SHA_512)) as Hex_512; //derive 64 bytes, important to not exceed the hmac size
                
                //use the first 4 bytes to calculate the offset
                offset = (keyData[0] << 24) | (keyData[1] << 16) | (keyData[2] << 8) | keyData[3];
                offset = offset >>> 0; //convert to unsigned integer
                offset = offset & ((memoryUint8Array.length - keyData.length) - 1); //subtract keyData.length to ensure we have enough space for the key data. we can use a bitwise AND to get the modulo since the length is a power of 2
                
                //inject the key data into the memory buffer at the calculated offset
                memoryUint8Array.set(keyData, offset);
 
                _.check(progressors[0].setProgress((i + 1) / (rounds + 1), undefined));
            }
        
            //derives the result using the final memory buffer
            const result = _.value(await this._app.hmacUtil.derive(hmacKey, memoryUint8Array as PAE, HMACOutputFormat.Hex));

            _.check(progressors[0].setProgress(1, undefined));

            if (options?.log === true) this.log('hardened in', Math.ceil((performance.now() - a)), 'ms');

            //return the result in the requested format
            return [(format === HardenOutputFormat.Hex_512) ? result : _.value(await this._app.keyUtil.import(result, KeyType.HKDF)), {rounds, memory, iterations}];
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to harden password.', [options], {names:[PasswordHelper, this.harden]});
        }
    }

    /**
     * Estimates the time to crack a password with the given entropy and hashing parameters.
     * @param {number} entropy - The entropy of the password in bits.
     * @returns {Promise<number>} A Promise that resolves to the estimated time to crack the password in seconds.
     */
    private _measureCache:any = {}; //cache, so we don't have to measure the same values more than once
    public async estimateTimeToCrack(entropy:number, options?:{rounds?:number, iterations?:number, memory?:number}):Promise<string>
    {
        const rounds = options?.rounds ?? this._config.rounds;
        const iterations = options?.iterations ?? this._config.iterations;
        const memory = options?.memory ?? this._config.memory;

        const measureHashingSpeed = async (progressor:IProgressor<A, undefined>):Promise<number> =>
        {
            const password = this._app.textUtil.generate(16, {charset:CharSet.Base16}); //because the browser caches pbkdf2 results
            const salt = this._app.byteUtil.generate<Hex_1024>(128, {insecure:true});

            const startTime = performance.now();

            await this.harden(password, salt, progressor, HardenOutputFormat.Hex_512, {rounds, iterations, memory, log:false});
            
            const endTime = performance.now();
    
            return endTime - startTime;
        }

        const key = `${entropy}-${rounds}-${iterations}-${memory}`;
        const measureCache = this._measureCache;

        let timeToCrackInSeconds = measureCache[key];
        if (timeToCrackInSeconds === undefined) 
        {
            const time = await measureHashingSpeed(new Progressor(this._app, () => true, [this]));
            const totalCombinations = Math.pow(2, entropy);

            //average case scenario for collision probability
            let timeNeeded = (totalCombinations / 100000) * time; //estimate that the key could be discovered after testing .001% of the key space

            //adjust time calculation based on browser performance
            const performanceAdjustmentFactor = this._app.browserUtil.isFirefox() ? 2 : 1;
            timeNeeded *= performanceAdjustmentFactor;

            //convert to seconds
            timeToCrackInSeconds = measureCache[key] = timeNeeded / 1000;
        }
        
        const formatTime = (time:number, unit:string):string => `~${Math.floor(time).toLocaleString()} ${unit}`;

        const secondsInMinute = 60;
        const secondsInHour = secondsInMinute * 60;
        const secondsInDay = secondsInHour * 24;
        const secondsInYear = secondsInDay * 365.25;
        const secondsInThousandYears = secondsInYear * 1e3;
        const secondsInMillionYears = secondsInYear * 1e6;
        const secondsInBillionYears = secondsInYear * 1e9;
        const secondsInTrillionYears = secondsInYear * 1e12;
        const secondsInQuadrillionYears = secondsInYear * 1e15;
        const secondsInQuintillionYears = secondsInYear * 1e18;
        const secondsInSextillionYears = secondsInYear * 1e21;
        const secondsInSeptillionYears = secondsInYear * 1e24;
        const secondsInOctillionYears = secondsInYear * 1e27;
        const secondsInNonillionYears = secondsInYear * 1e30;
        const secondsInDecillionYears = secondsInYear * 1e33;
        const secondsInUndecillionYears = secondsInYear * 1e36;
        const secondsInDuodecillionYears = secondsInYear * 1e39;
        const secondsInTredecillionYears = secondsInYear * 1e42;
        const secondsInQuattuordecillionYears = secondsInYear * 1e45;
        const secondsInQuindecillionYears = secondsInYear * 1e48;
        const secondsInSexdecillionYears = secondsInYear * 1e51;
        const secondsInSeptendecillionYears = secondsInYear * 1e54;
        const secondsInOctodecillionYears = secondsInYear * 1e57;
        const secondsInNovemdecillionYears = secondsInYear * 1e60;
        const secondsInVigintillionYears = secondsInYear * 1e63;
      
        const timeUnits: [number, string][] = 
        [
            [secondsInMinute, "minutes"],
            [secondsInHour, "hours"],
            [secondsInDay, "days"],
            [secondsInYear, "years"],
            [secondsInThousandYears, "thousand years"],
            [secondsInMillionYears, "million years"],
            [secondsInBillionYears, "billion years"],
            [secondsInTrillionYears, "trillion years"],
            [secondsInQuadrillionYears, "quadrillion years"],
            [secondsInQuintillionYears, "quintillion years"],
            [secondsInSextillionYears, "sextillion years"],
            [secondsInSeptillionYears, "septillion years"],
            [secondsInOctillionYears, "octillion years"],
            [secondsInNonillionYears, "nonillion years"],
            [secondsInDecillionYears, "decillion years"],
            [secondsInUndecillionYears, "undecillion years"],
            [secondsInDuodecillionYears, "duodecillion years"],
            [secondsInTredecillionYears, "tredecillion years"],
            [secondsInQuattuordecillionYears, "quattuordecillion years"],
            [secondsInQuindecillionYears, "quindecillion years"],
            [secondsInSexdecillionYears, "sexdecillion years"],
            [secondsInSeptendecillionYears, "septendecillion years"],
            [secondsInOctodecillionYears, "octodecillion years"],
            [secondsInNovemdecillionYears, "novemdecillion years"],
            [secondsInVigintillionYears, "vigintillion years"],
        ];

        const ordersOfMagnitudeFaster = timeToCrackInSeconds / 1e9;
        if (ordersOfMagnitudeFaster < timeUnits[0][0]) return '< 1 minute';

        for (let i = 0; i < timeUnits.length; i++)
        {
            if (ordersOfMagnitudeFaster >= timeUnits[i][0]) continue;

            return formatTime(ordersOfMagnitudeFaster / timeUnits[i - 1][0], timeUnits[i - 1][1]);
        }
        
        const yearsInVigintillion = ordersOfMagnitudeFaster / secondsInVigintillionYears;
        return `> ${yearsInVigintillion.toLocaleString()} vigintillion years`; 
    }
}