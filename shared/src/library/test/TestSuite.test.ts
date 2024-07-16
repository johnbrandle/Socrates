/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../IDestructor";
import { DestructableEntity } from "../entity/DestructableEntity";

type TestFunc = () => Promise<void | string>;

type Options = 
{
    id:string, 
    message?:string,
    details?:string,
    onFail?:() => void,
};

export class TestSuite<A extends IBaseApp<A>> extends DestructableEntity<A> 
{
    private _initialized = false;
  
    private _tests:Map<string, TestFunc> = new Map();
    private _suites:TestSuite<A>[] = [];
  
    private _currentRunningTestName:string = '';

    private _log:Array<string> = [];

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }

    public async init(...args:any):Promise<TestSuite<A>>
    {
        if (this._initialized === true) throw new Error('TestSuite already initialized');
        this._initialized = true;

        return this;
    }

    public addTest(testFunc:TestFunc):void;
    public addTest(name:string, testFunc:TestFunc):void;
    public addTest(...args:any)
    {
        if (this._app.typeUtil.isFunction(args[0]) === true) return this.addTest(args[0].name.replace('_', '.'), args[0].bind(this));

        const [name, testFunc] = args;

        if (this._tests.has(name) === true) throw new Error(`Test ${name} already exists`);

        this._tests.set(name, testFunc);
    }

    public addSuite(suite:TestSuite<A>):void 
    {
        this._suites.push(suite);
    }

    protected async createSuite<T extends TestSuite<A>>(Class:new (app:A, destructor:IDestructor<A>) => T):Promise<T>
    {
        const testSuite = new Class(this._app, this);
        await testSuite.init();

        return testSuite;
    }
  
    public async run() 
    {
        if (this._initialized !== true) throw new Error('TestSuite not initialized');

        //first run the tests in this suite
        const a = performance.now();
        for (const [name, testFunc] of this._tests) 
        {
            this._currentRunningTestName = name;
            
            const a1 = performance.now();
            const info = await testFunc();
            const b1 = performance.now();
            this._app.consoleUtil.log(this.constructor, `✔️  ${name}` + (info !== undefined ? `, ${info}` : ''), (b1 - a1).toFixed(0) + 'ms');

            await this._app.promiseUtil.wait(1);
        }
        const b = performance.now();

        this._app.consoleUtil.log(this.#constructError, `🕒 TestSuite finished in ${(b - a).toFixed(0)}ms`);

        //then run the tests in nested suites
        for (const suite of this._suites) await suite.run();
    }

    protected assertEquals(actual:any, expected:any, options?:Options):void | never
    {
        if (actual instanceof Uint8Array && expected instanceof Uint8Array) 
        {
            if (actual.length !== expected.length) throw this.#constructError(`Expected ${expected.length} bytes, but got ${actual.length}`, options);
            for (let i = 0; i < actual.length; i++) 
            {
                if (actual[i] !== expected[i]) throw this.#constructError(`Expected ${expected[i]} at index ${i}, but got ${actual[i]}`, options);
            }
        }
        else if (actual !== expected) throw this.#constructError(`Expected ${expected}, but got ${actual}`, options);
    }
    
    protected assertTrue(value:unknown, options?:Options):void | never 
    {
        if (value !== true) throw this.#constructError(`Expected true, but got false`, options);
    }
    
    protected assertFalse(value:boolean, options?:Options):void | never
    {
        if (value !== false) throw this.#constructError(`Expected false, but got true`, options);
    }

    protected fail(options?:Options):never
    {
        throw this.#constructError(`Test failed`, options);
    }

    protected async assertThrows(func:() => Promise<any> | any, options?:Options):Promise<void>
    {
        try
        {
            await func();
        }
        catch (error)
        {
            return;
        }

        throw this.#constructError(`Expected function to throw an error, but it did not`, options);
    }

    #constructError = (message:string, options?:Options):Error =>
    {
        message = options?.message ?? message;
        message = this._currentRunningTestName + ', ' + message + (options?.id ? ` (${options.id})` : '');
        message = options?.details ? message + '\n' + options.details : message;

        if (options?.details !== undefined) this._log.push(options.details);

        if (options?.onFail) options.onFail();

        const error = new Error(message);
        if (Error.captureStackTrace !== undefined) Error.captureStackTrace(error, this.#constructError); //capture the stack trace, but exclude this function

        return error;
    }
}