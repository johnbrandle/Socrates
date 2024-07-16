/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { KnownLengthReadableStream } from "../stream/KnownLengthReadableStream";
import { MinLengthReadableStream } from "../stream/MinLengthReadableStream";
import { FolderPath } from "../file/Path";
import { SerializationHelper } from "../helpers/SerializationHelper";
import { IBaseApp } from "../IBaseApp";
import { TestSuite } from "../test/TestSuite.test";
import { uint } from "./IntegerUtil";
import { Value, ValueType } from "./SerializationUtil";

export class SerializationUtilTestSuite<A extends IBaseApp<A>> extends TestSuite<A> 
{
    public override async init():Promise<TestSuite<A>>
    {
        await super.init();
     
        this.addTest(this.SerializationUtil_toStream_fromStream);
    
        return this;
    }

    public async SerializationUtil_toStream_fromStream():Promise<string>
    {
        const serializationHelper = new SerializationHelper(this._app);
        const app = this._app;

        const times = [];

        for (let i = 0; i < 1000; i++)
        {
            let test = this.#createTestValues();

            const start = performance.now();
            
            const stream = this._app.extractOrRethrow(await serializationHelper.toStream(test, {splitSyncAndAsyncStreams:false}));
            
            
            const values = [];

            const [stream1, stream2] = stream.tee();

            try
            {
                for await (let result of serializationHelper.fromStream(stream2, {}))
                {
                    result = this._app.extractOrRethrow(result);

                    values.push(result);
                }

                this._app.arrayUtil.randomize(values); //read the results in a random order
                for (const result of values)
                {
                    const {type, value} = result;

                    if (type === ValueType.Generator) for (const v of value as Generator) {}
                    if (type === ValueType.ReadableStream) await app.streamUtil.toUint8Array(value as ReadableStream<Uint8Array>);
                    if (type === ValueType.AsyncGenerator) for await (const v of value as AsyncGenerator) {}
                    if (type === ValueType.KnownLengthReadableStream) await app.streamUtil.toUint8Array(value as KnownLengthReadableStream<Uint8Array>);
                    if (type === ValueType.MinLengthReadableStream) await app.streamUtil.toUint8Array(value as MinLengthReadableStream<Uint8Array>);
                }

                const end = performance.now();

                times.push(end - start);
            }
            catch (error)
            {
                console.log(i);
                console.log(test);
                console.log(values);
                console.log(await app.streamUtil.toUint8Array(stream1));

                debugger;
            }
        }

        //console.log(times);
        //console.log(times.reduce((a, b) => a + b, 0) / times.length);

        for (let i = 0; i < 1000; i++)
        {
            let test = this.#createTestValues();

            const streams = this._app.extractOrRethrow(await serializationHelper.toStream(test, {splitSyncAndAsyncStreams:true}));
            const values = [];

            const [stream1Sync, stream2Sync] = streams[0].tee();
            const [stream1Async, stream2Async] = streams[1].tee();
            const count = streams[2];
    
            try
            {
                for await (let result of serializationHelper.fromStream([stream2Sync, stream2Async], {count}))
                {
                    result = this._app.extractOrRethrow(result);

                    values.push(result);
                }

                this._app.arrayUtil.randomize(values); //read the results in a random order
                for (const result of values)
                {
                    const {type, value} = result;

                    if (type === ValueType.Generator) for (const v of value as Generator) {}
                    if (type === ValueType.ReadableStream) await app.streamUtil.toUint8Array(value as ReadableStream<Uint8Array>);
                    if (type === ValueType.AsyncGenerator) for await (const v of value as AsyncGenerator) {}
                    if (type === ValueType.KnownLengthReadableStream) await app.streamUtil.toUint8Array(value as KnownLengthReadableStream<Uint8Array>);
                    if (type === ValueType.MinLengthReadableStream) await app.streamUtil.toUint8Array(value as MinLengthReadableStream<Uint8Array>);
                }
            }
            catch (error)
            {
                console.log(i);
                console.log(count);
                console.log(test);
                console.log(values);
                console.log(await app.streamUtil.toUint8Array(stream1Sync));
                console.log(await app.streamUtil.toUint8Array(stream1Async));
                
                debugger;
            }
        }
        
        return '';
    }

    #createTestValues():Value[]
    {
        let position = 0;
        const app = this._app;
      
        const getRandomUint8Array = () => new Uint8Array(app.integerUtil.generate(0 as uint, 100000 as uint));

        const array = getRandomUint8Array();
        const chunkSize = app.integerUtil.generate(1 as uint, 50000 as uint);

        const testStream = new ReadableStream(
        {
            start(controller)
            {
                if (array.byteLength === 0) controller.close(); //immediately close the stream
            },
            pull(controller) 
            {
                //check if we've reached the end of the array.
                if (position < array.byteLength) 
                {
                    //get the next chunk to enqueue.
                    const chunk = array.subarray(position, Math.min(position + chunkSize, array.byteLength));
                    controller.enqueue(chunk);
        
                    //update the position.
                    position += chunkSize;
        
                    //if the position reaches the end, close the stream.
                    if (position >= array.byteLength) controller.close();
                }
            }
        }, {highWaterMark:chunkSize});

        const [testStream1, testStream2] = testStream.tee();

        const subArray1:Value[] = [5, 5, 5, 5, {a:1}];

        function* generator():Generator<Value, void, unknown> 
        {
            for (const value of subArray1) yield value;
        }

        const subArray2:Value[] = 
        [
            {
                b:
                [
                    {c:1}
                ], 
                generator:generator()
            }
        ];

        function* generator2():Generator<Value, void, unknown> 
        {
            for (const value of subArray2) yield value;
        }

        async function* asyncGenerator():AsyncGenerator<Value, void, unknown> 
        {
            for (const value of subArray2) yield value;
        }

        let test:any = 
        [
            
            app.streamUtil.fromUint8Array(getRandomUint8Array()),

            app.streamUtil.fromUint8Array(getRandomUint8Array()),
            testStream1,

            true,

            

            new FolderPath('/'),
            generator2(),
     
            asyncGenerator(),
            testStream2, 
            app.streamUtil.fromUint8Array(new Uint8Array([1, 2, 3])),
            app.streamUtil.fromUint8Array(new Uint8Array([1, 2, 3])),
            
            app.streamUtil.create(app.integerUtil.generate(0 as uint, 381 as uint), {start:(controller) => { controller.enqueue(new Uint8Array(app.integerUtil.generate(381 as uint, 10000 as uint))); controller.close(); }, isMinLength:true, excludeController:true}),
            app.streamUtil.fromUint8Array(new Uint8Array([1, 2, 3])),
            undefined,

            new FolderPath('/'),
            true,
            false,

            false,
            false,
            false, 
            
            '',
            "foo", 
            
            -1,
            0,
            1, 
            1.3334,
            
            123456789n,

            subArray2,

            
            [],

            [1, 2, 3, 'a', true, false],

            {},
            {a:1, b:{f:{g:"testing"}}, c:[1, 2, 3]},    
       
            new Uint8Array([1, 2, 3]),
    
            true,
            app.streamUtil.fromUint8Array(new Uint8Array([1, 2, 3])),
            app.streamUtil.fromUint8Array(new Uint8Array([1, 2, 3])),

            'CUSTOM_VALUE_TYPE',
           
            '',
            {a:1, b:{f:{}, d:1}},
            [1, 2, 3, 'a', true, false],
            {a:1, b:{f:{g:"testing"}}, c:[1, 2, 3]},   
        ];

        this._app.arrayUtil.randomize(test);

        const numberToRemove = app.integerUtil.generate(0 as uint, test.length);
        test.splice(0, numberToRemove);

        return test;
    }
}