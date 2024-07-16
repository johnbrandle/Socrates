import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

export class File
{
    name: string;
    path: string;
    type: string;
    size: number;
    lastModified: number;

    constructor(filePath:string) 
    {
        if (!fs.existsSync(filePath)) throw new Error('File does not exist');    

        this.path = filePath;
        this.name = path.basename(filePath);
        this.type = mime.lookup(filePath) || 'application/octet-stream';
        const stats = fs.statSync(filePath);
        this.size = stats.size;
        this.lastModified = stats.mtimeMs;
    }

    get webkitRelativePath():never 
    {
        throw new Error('The webkitRelativePath property is not available in a Node.js environment');
    }

    async text(): Promise<string> 
    {
        return fs.promises.readFile(this.path, 'utf8');
    }

    async blob(): Promise<Buffer> 
    {
        return fs.promises.readFile(this.path);
    }

    async arrayBuffer():Promise<ArrayBuffer> 
    {
        return await fs.promises.readFile(this.path);
    }

    stream(): ReadableStream<Buffer> 
    {
        const nodeStream = fs.createReadStream(this.path);
        const reader = nodeStream[Symbol.asyncIterator]();
    
        let cancelled = false;
        return new ReadableStream<Buffer>(
        {
            async pull(controller) 
            {
                try 
                {
                    //this loop will run until the controller's desired size is greater than zero
                    //which means that the consumer is ready to receive more data.
                    while ((controller.desiredSize ?? undefined) === undefined || controller.desiredSize! > 0) 
                    {
                        const {value, done} = await reader.next();

                        if (cancelled === true) return;
                        
                        if (done) 
                        {
                            controller.close();
                            break;
                        }

                        controller.enqueue(value);
                    }
                } 
                catch (error) 
                {
                    controller.error(error);
                    nodeStream.destroy();
                }
            },
            cancel(reason) 
            {
                cancelled = true;
                nodeStream.destroy();
            }
        });
    }

    slice(start:number, end:number):Buffer
    {
        throw new Error('File not implemented');
    }
}
