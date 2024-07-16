import path from 'path';
import webpack from 'webpack';
import chokidar from 'chokidar';
import events from 'events';
import type { IConfig } from './IConfig';
import { Main } from '../Main';

export class Compiler extends events.EventEmitter
{
    public static readonly EVENT_READY = 'ready';
    public static readonly EVENT_CHANGE = 'change';

    private static idCounter = 0;

    _id:number = Compiler.idCounter++;
    _options:IConfig;

    _compiler:webpack.Compiler;

    constructor(options:IConfig, watch:boolean)
    {
        super();

        this._options = options;

        this._compiler = webpack(options.getOptions());

        if (watch) this.watch();
        else setTimeout(() => this.emit(Compiler.EVENT_READY), 250);
    }

    private watch()
    {
        let ignored:Array<string|RegExp> = [/node_modules/,
                                            /(^|[\/\\])\../, //ignore dot files
        ];

        ignored = ignored.concat(this._options.watchIgnored);
        const watcher = chokidar.watch(this._options.watchFiles, //watch for file changes and compile if any are detected
        {
            ignored: ignored,
            persistent:true,
            cwd:Main.ROOT_PATH
        });

        watcher.on('add', (path:string) => console.log(`File ${path} has been added`));
        watcher.on('change', (path:string) => 
        {
            this.emit(Compiler.EVENT_CHANGE)
        });
        watcher.on('unlink', (path:string) => console.log(`File ${path} has been removed`));
        watcher.on('error', (error:string) => console.log(`Watcher error: ${error}`));
        watcher.on('ready', () => this.emit(Compiler.EVENT_READY));
    }

    public compile():Promise<void>
    {    
        return new Promise((resolve, reject) => 
        {
            this._compiler.run((err:unknown, stats:any) => 
            {
                if (err) console.error(err);
                console.log(stats.toString({ colors:true }));
    
                this._compiler.close((closeErr:unknown) => 
                {
                    if (closeErr) 
                    {
                        console.error(closeErr);
                        reject(closeErr);
                        return;
                    } 
                    
                    resolve();
                });
            });
        });
    }

    public async doPre()
    {
        await this._options.getPreBuild();
    }

    public async doPost()
    {
        await this._options.getPostBuild();
    }

    get id()
    {
        return this._id;
    }
}