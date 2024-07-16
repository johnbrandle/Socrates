/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { TestRunner } from "../../../../shared/src/library/test/TestRunner.test";
import { App, AppTestSuite } from "./app/App.test";

const environment = self.environment;

export class Main
{
    #_testRunner!:TestRunner<App>;

    constructor() {}

    async init()
    {     
        const app = new App(environment);
        await app.init();

        const testRunner = this.#_testRunner = new TestRunner(app);

        testRunner.addSuite(await new AppTestSuite(app).init());

        await this.#_testRunner.run();

        app.consoleUtil.log(this.constructor, 'Testing complete!');
    }
}