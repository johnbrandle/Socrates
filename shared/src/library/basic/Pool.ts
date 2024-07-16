/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

/**
 * Represents an item within the pool, holding an instance of the resource and a timeout identifier.
 * @template T - The type of the instance held within the pool item.
 * @property {T} instance - The actual instance of the resource.
 * @property {number | undefined} timeout - A timeout identifier for tracking idle time, possibly undefined.
 */
interface PoolItem<T> 
{
    instance:T;
    timeout:number | undefined;
}

/**
 * A factory function type for creating new instances of the pooled resource.
 * @template T - The type of the instance that the function creates.
 * @returns {Promise<T>} A promise that resolves to a new instance of the resource.
 */
type CreateInstanceFn<T> = () => Promise<T>;

/**
 * Manages a pool of instances, allowing for reuse and limiting the total number of concurrent instances.
 * Instances that remain idle for a specified duration are automatically destroyed.
 * @template T - The type of the instances managed by the pool.
 */
export class Pool<T> 
{
    private instancePool:PoolItem<T>[] = [];
    private _instanceCount:number = 0;

    private maxInstances:number;
    private idleTime:number; //time in milliseconds
    private queue:((instance:T) => void)[] = [];
    private createInstance:CreateInstanceFn<T>;
    private destoryInstance:((instance:T) => void) | undefined;

    /**
     * Creates a pool for managing instances of a particular resource.
     * @param {number} maxInstances - The maximum number of instances that can be created.
     * @param {number} idleTime - The amount of time (in milliseconds) an instance has to be idle before it is destroyed.
     * @param {CreateInstanceFn<T>} createInstance - A function to create new instances for the pool.
     * @param {(instance: T) => void} [destoryInstance] - An optional function to destroy instances when they are no longer needed.
     */
    constructor(maxInstances:number, idleTime:number, createInstance:CreateInstanceFn<T>, destoryInstance:((instance:T) => void) | undefined)
    {
        this.maxInstances = maxInstances;
        this.idleTime = idleTime;
        this.createInstance = createInstance;
        this.destoryInstance = destoryInstance;
    }

    /**
     * Schedules the cleanup of an instance after it has been idle for the configured idleTime.
     * @private
     * @param {PoolItem<T>} poolItem - The pool item that should be cleaned up.
     */
    private scheduleCleanup(poolItem:PoolItem<T>) 
    {
        poolItem.timeout = window.setTimeout(() => 
        {
            const index = this.instancePool.indexOf(poolItem);
            if (index == -1) return; 
            
            this._instanceCount--;
            this.instancePool.splice(index, 1);
            
            if (this.destoryInstance !== undefined) this.destoryInstance(poolItem.instance);
        }, this.idleTime);
    }

    /**
     * Borrows an instance from the pool. If all instances are currently in use and the max limit is reached,
     * the request is queued until an instance becomes available.
     * @returns {Promise<T>} A promise that resolves to an instance from the pool.
     */
    public async borrow():Promise<T> 
    {
        const availableItem = this.instancePool.find(item => item.timeout !== undefined);
        if (availableItem) 
        {
            clearTimeout(availableItem.timeout!);
            availableItem.timeout = undefined;

            return availableItem.instance;
        }

        if (this._instanceCount < this.maxInstances) 
        {
            this._instanceCount++;
            const newInstance = await this.createInstance();

            const newPoolItem:PoolItem<T> = {instance:newInstance, timeout:undefined};
            this.instancePool.push(newPoolItem);

            return newInstance;
        }

        return new Promise<T>(async (resolve) => this.queue.push(resolve));
    }
    
    /**
     * Returns an instance back to the pool. If there are queued requests, the instance is immediately
     * passed to the next requester. Otherwise, the instance is scheduled for cleanup after the idle time.
     * @param {T} instance - The instance to return to the pool.
     * @throws {Error} Throws an error if the instance is not found in the pool.
     */
    public return(instance:T) 
    {
        const poolItem = this.instancePool.find(item => item.instance === instance);
        if (!poolItem) throw new Error('Instance not found in pool');

        if (this.queue.length > 0)
        {
            const nextInQueue = this.queue.shift()!;
            nextInQueue(instance);
            return;
        }

        this.scheduleCleanup(poolItem);
    }
}