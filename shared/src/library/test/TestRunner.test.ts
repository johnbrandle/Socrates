/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../IBaseApp";
import type { TestSuite } from "./TestSuite.test";

export class TestRunner<A extends IBaseApp<A>> 
{
    #_app:A;

    #_suites:TestSuite<A>[] = [];
  
    constructor(app:A) 
    {
        this.#_app = app;
    }

    public addSuite(suite:TestSuite<A>) 
    {
        this.#_suites.push(suite);
    }
  
    public async run() 
    {
        const a = performance.now();
        for (const suite of this.#_suites) 
        {
            const a1 = performance.now();
            await suite.run();
            const b1 = performance.now();

            this.#_app.consoleUtil.log(this.constructor, `🕒 TestSuite ${suite.constructor.name} finished in ${b1 - a1}ms`);
        }
        const b = performance.now();

        this.#_app.consoleUtil.log(this.constructor, `🕒 TestRunner finished in ${b - a}ms`);
    }
}