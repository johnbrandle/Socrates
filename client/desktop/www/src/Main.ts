/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { componentsByConstructorMap, componentsByPathMap } from "./library/decorators/ComponentDecorator";
import { App } from "./app/App";
import type { IComponent } from "./library/components/IComponent";
import { SealedDecorator } from "../../../../shared/src/library/decorators/SealedDecorator";
import type { IError } from "../../../../shared/src/library/error/IError";
import { DevEnvironment } from "../../../../shared/src/library/IEnvironment";
import type { IAborted } from "../../../../shared/src/library/abort/IAborted";

const environment = self.environment;

const loadComponentClasses = async () =>
{
    const log = (...datas:any):false =>
    {
        const args = ['%cMAIN', 'color: #388cc7'];

        for (let i = 0; i < datas.length; i++) args.push(datas[i]);
        
        console.log.apply(this, args);

        return false;
    }

    //for performance testing
    let time = 0;

    const promises:any[] = [];
    const regex = /(^\.\/)|(\.ts$)/g;

    const load = async (context:WebpackContext, basePath:string) =>
    {
        for (const file of context.keys())
        {
            //test files don't need to be loaded
            if (file.includes('.test.')) continue;

            let a = 0;
            if (environment.frozen.isDebug === true) a = performance.now();
            
            const promise = (context(file).then((module:Record<string, any>) => 
            {
                const relativePath = file.replace(regex, '');
                const name = relativePath.split('/').pop() ?? '';       
            
                const moduleDefault = module[name] ?? module.default;
                
                if (typeof moduleDefault !== 'function') return; //components must have a class export (either exported with name matching the filename or as default)
    
                const Class = moduleDefault as new (...args:any[]) => IComponent<any>;
                if (componentsByConstructorMap.has(Class) !== true) return; //component must be decorated with @ComponentDecorator
                
                const fullPath = `${basePath}${relativePath}`;

                //set the component class in the maps
                componentsByConstructorMap.set(Class, fullPath);
                componentsByPathMap.set(fullPath, Class);
            }).catch((error:Error) => { console.warn(error); }));

            if (environment.frozen.isDebug === true)
            {
                await promise;

                const b = performance.now();

                //if the load time is less than 10ms, it's not worth logging
                if (b - a > 10) log(Main.name, '—', 'load, time:', file, Number((b - a).toFixed(2)), 'ms'); 

                time += b - a;
            }

            promises.push(promise);
        }
    }

    //load app components
    const {context, path} = App.componentContext;    
    promises.push(load(context, path));

    //load library components
    promises.push(load(require.context('./library/components', true, /^(?!.*\.test\.ts$).*\.ts$/, 'eager'), 'library/components/'));
    
    await Promise.all(promises);

    if (environment.frozen.isDebug === true) log(Main.name, '— components loaded in:', Math.ceil(time), 'ms');
}

@SealedDecorator()
class Main
{
    #_app!:App;
    #_initialized = false;

    public async init():Promise<true | IAborted | IError>
    {        
        if (this.#_initialized === true) return true;
        this.#_initialized = true;

        const app = new App(environment);
        this.#_app = app;

        return app.init();
    }
}

await loadComponentClasses();

if (environment.frozen.devEnvironment === DevEnvironment.Test) (new ((await import('./Main.test')).Main)).init();
else new Main().init();