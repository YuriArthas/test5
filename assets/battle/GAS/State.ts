import { World } from "./World";

export interface IGAS_Ref {
    world: World;
    gas_id: number;
    get valid(): boolean;
    
    /**
     * 类元数据访问器 (只有被@GAS_State装饰的类才有)
     */
    readonly CLASS_META?: {
        readonly gas_property_names: string[];
        readonly gas_property_metadata: Map<string, GAS_Property_Meta>;
        readonly gas_ordered_properties: { propName: string; meta: GAS_Property_Meta }[];
        
        getProperty(name: string): Readonly<GAS_Property_Meta> | undefined;
        hasProperty(name: string): boolean;
        readonly propertyCount: number;
        readonly isGASClass: boolean;
    };
}



export class GAS_Ref implements IGAS_Ref {
    world: World;
    gas_id: number;

    get valid(): boolean {
        return this.world.is_ref_valid(this);
    }

    constructor(world: World, gas_id: number) {
        this.world = world;
        this.gas_id = gas_id;
        world.add_id_state(this, true);
    }
}

// /**
//  * 定义了可以被 @GAS_State 装饰的类的契约。
//  * 实例必须能提供一个 get_world 方法。
//  */
// export interface IGASStateful{
//     new(world: World, gas_id: number, ...args: any[]): IGASStateful;
// };

class GAS_Map<K, V> extends Map<K, V> implements IGAS_Ref {
    world: World;
    gas_id: number;
    private _gas_sync_enabled = false;

    get valid(): boolean {
        return this.world.is_ref_valid(this);
    }

    constructor(world: World, gas_id: number) {
        super();
        this.world = world;
        this.gas_id = gas_id;
        world.add_id_state(this, true);
    }

    set(key: K, value: V): this {
        const oldValue = this.get(key);
        const result = super.set(key, value);
        
        if (this._gas_sync_enabled && oldValue !== value) {
            const world = this.world;
            if (world) {
                world.syncer.on_self_state_changed({
                    type: GAS_SyncEventType.PropertyChanged,
                    target: this,
                    propertyName: key as string | number,
                    op: GAS_PropertyChangedEventOperatorType.SET,
                    newValue: value
                });
            }
        }
        
        return result;
    }

    delete(key: K): boolean {
        const had = this.has(key);
        const result = super.delete(key);
        
        if (this._gas_sync_enabled && had) {
            const world = this.world;
            if (world) {
                world.syncer.on_self_state_changed({
                    type: GAS_SyncEventType.PropertyChanged,
                    target: this,
                    propertyName: key as string | number,
                    op: GAS_PropertyChangedEventOperatorType.REMOVE,
                    newValue: undefined
                });
            }
        }
        
        return result;
    }

    public syncGASState(): void {
        if (!this._gas_sync_enabled) {
            this._gas_sync_enabled = true;
        }

        const world: World = this.world;
        if (!world) {
            return;
        }

        // 同步Map中的所有键值对
        world.syncer.on_self_state_changed({
            type: GAS_SyncEventType.FULL_SYNC,
            target: this,
        });
    }
}

class GAS_Set<T> extends Set<T> implements IGAS_Ref {
    world: World;
    gas_id: number;

    constructor(world: World, gas_id: number) {
        super();
        this.gas_id = gas_id;
        world.add_id_state(this, true);
    }

    get valid(): boolean {
        return this.world.is_ref_valid(this);
    }
}

class GAS_Array<T> extends Array<T> implements IGAS_Ref {
    world: World;
    gas_id: number;

    constructor(world: World, gas_id: number) {
        super();
        this.gas_id = gas_id;
        world.add_id_state(this, true);
    }

    set(index: number, value: T) {
        this[index] = value;
    }

    at(index: number) {
        return this[index];
    }

    get valid(): boolean {
        return this.world.is_ref_valid(this);
    }
}

/**
 * GAS属性的元数据类型定义。
 * type: 属性的构造函数，可以是类，也可以是Number, String等原生类型。
 */
export interface GAS_Property_Meta {
    type: IGAS_Ref | Number | String | Boolean;
    name: string;
}

export enum GAS_SyncEventType {
    CustomEvent,
    
    PropertyChanged,
    
    CreateState,
    RemoveState,

    FULL_SYNC,
    CLEAR,

    LogicFrameEnd,
    SyncFrameEnd,
}

export enum GAS_PropertyChangedEventOperatorType {
    SET = 0,
    INSERT = 1,
    REMOVE = 2,
    SPLICE = 3,
}

export interface GAS_SyncEvent {
    type: GAS_SyncEventType;
    target: any;
}

/**
 * 属性变化事件
 */
export interface GAS_PropertyChangedEvent extends GAS_SyncEvent {
    
    propertyName?: string|number;
    op?: GAS_PropertyChangedEventOperatorType;  // 操作类型，默认为SET
    newValue?: any;
    property_meta?: GAS_Property_Meta;
}

/**
 * @GAS_Property 装饰器工厂
 * @param property_meta 元数据对象, 必须包含type字段, e.g., { type: Unit }
 */
export function GAS_Property<T extends IGAS_Ref>(property_meta: GAS_Property_Meta): (target: T, propertyName: string) => void {
    return function (prototype: any, propertyName: string) {
        const constructor = prototype.constructor;
        
        // 1. 注册原始属性名到类的静态属性
        if (!constructor.__gas_property_names__) {
            constructor.__gas_property_names__ = [];
        }
        if (constructor.__gas_property_names__.indexOf(propertyName) === -1) {
            constructor.__gas_property_names__.push(propertyName);
        }

        // 2. 存储元数据到类的静态属性
        if (!constructor.__gas_property_metadata__) {
            constructor.__gas_property_metadata__ = new Map<string, GAS_Property_Meta>();
        }
        constructor.__gas_property_metadata__.set(propertyName, property_meta);

        const privateKey = `_${propertyName}`;
    
        Object.defineProperty(prototype, propertyName, {
            get() {
                return this[privateKey];
            },
            set(newValue: any) {
                const oldValue = this[privateKey];
                this[privateKey] = newValue;

                if ((this as any)._gas_sync_enabled && oldValue !== newValue) {
                    const world = (this as T).world;
                    if (world) {
                        world.syncer.on_self_state_changed({
                            type: GAS_SyncEventType.PropertyChanged,
                            target: this,
                            propertyName,
                            newValue,
                            property_meta: property_meta
                        });
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
    }
}

/**
 * @GAS_State 装饰器
 */
export function GAS_State<T extends new (...args: any[]) => IGAS_Ref>(constructor: T): T {
    // --- 预收集和排序逻辑 ---
    const orderedProperties: { propName: string; meta: GAS_Property_Meta }[] = [];
    const seenProperties = new Set<string>();
    const prototypeChain: any[] = [];
    
    let currentProto = constructor.prototype;
    while (currentProto && currentProto !== Object.prototype) {
        prototypeChain.unshift(currentProto); // Parent -> Child order
        currentProto = Object.getPrototypeOf(currentProto);
    }

    // 1. 先合并所有元数据，子类会覆盖父类的
    const finalMetaMap = new Map<string, any>();
    for (const proto of prototypeChain) {
        const ctor = proto.constructor;
        const metaOnThisLevel = ctor.__gas_property_metadata__;
        if (metaOnThisLevel) {
            for (const [propName, meta] of metaOnThisLevel.entries()) {
                finalMetaMap.set(propName, meta);
            }
        }
    }

    // 2. 按照父->子顺序，构建最终的有序列表
    for (const proto of prototypeChain) {
        const ctor = proto.constructor;
        const propsOnThisLevel = ctor.__gas_property_names__ || [];
        for (const propName of propsOnThisLevel) {
            if (!seenProperties.has(propName)) {
                // 使用在第一步中已经合并好的、子类优先的元数据
                const finalMeta = finalMetaMap.get(propName);
                if (finalMeta) { // 确保元数据存在
                    orderedProperties.push({ propName: propName, meta: finalMeta });
                }
                seenProperties.add(propName);
            }
        }
    }
    
    // --- 预收集结束 ---

    // 创建CLASS_META对象
    const classMeta = {
        gas_property_names: Array.from(seenProperties),
        gas_property_metadata: finalMetaMap,
        gas_ordered_properties: orderedProperties,
        
        // 便捷方法
        getProperty(name: string) {
            return classMeta.gas_property_metadata.get(name);
        },
        
        hasProperty(name: string) {
            return classMeta.gas_property_metadata.has(name);
        },
        
        get propertyCount() {
            return classMeta.gas_property_names.length;
        },
        
        get isGASClass() {
            return classMeta.gas_property_names.length > 0;
        }
    };

    const WrappedClass = class extends (constructor as any) {
        private _gas_sync_enabled = false;

        // 类元数据访问器 - 返回预创建的闭包
        get CLASS_META() {
            return classMeta;
        }

        constructor(...args: any[]) {
            super(...args);
        }
        
        /**
         * 首次调用时，会同步所有预收集的GAS属性，并开启后续的自动变更通知。
         */
        public syncGASState(): void {
            if (!this._gas_sync_enabled) {
                this._gas_sync_enabled = true;
            }

            const world: World = this.world;
            if (!world) {
                return;
            }
            
            // 从CLASS_META获取属性列表
            const propertiesToSync = this.CLASS_META.gas_ordered_properties;
            
            if (propertiesToSync && propertiesToSync.length > 0) {
                world.syncer.on_self_state_changed({
                    type: GAS_SyncEventType.FULL_SYNC,
                    target: this,
                });
            }
        }
    };

    return WrappedClass as unknown as T;
}