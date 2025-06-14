import { World } from "./World";

export interface IGAS_Ref {
    world: World;
    gas_id: number;
    get valid(): boolean;
}

/**
 * GAS类的静态属性接口
 */
export interface GASClassStatic {
    __gas_property_names__?: string[];
    __gas_property_metadata__?: Map<string, GAS_Property_Meta>;
    __gas_ordered_properties__?: { propName: string; meta: GAS_Property_Meta }[];
    
    getGASProperties?(): { propName: string; meta: GAS_Property_Meta }[];
    getGASPropertyMetadata?(): Map<string, GAS_Property_Meta>;
    getGASPropertyNames?(): string[];
    isGASClass?(): boolean;
}

/**
 * GAS类的构造函数类型
 */
export type GASConstructor = (new (...args: any[]) => IGAS_Ref) & GASClassStatic;

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
    type: 
        IGAS_Ref |
        Number | String | Boolean |
        GAS_Map<string, GAS_Property_Meta> | GAS_Map<number, GAS_Property_Meta> |
        GAS_Set<GAS_Property_Meta> |
        GAS_Array<GAS_Property_Meta>;
}

export enum GAS_SyncEventType {
    CustomEvent,
    
    PropertyChanged,
    
    CreateState,
    RemoveState,

    FULL_SYNC,

    
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
    meta?: GAS_Property_Meta;
}



/**
 * 临时存储每个类在定义时拥有的GAS属性名。
 */
export const rawGasProperties = new Map<any, string[]>();

/**
 * 临时存储每个类在定义时拥有的GAS属性元数据。
 */
export const gasPropertyMetadata = new Map<any, Map<string, any>>();

/**
 * 最终存储每个@GAS_State类预收集、排序好的属性列表。
 * 结构为: { propName: string; meta: any }[]
 */
export const preCollectedGasProperties = new Map<any, { propName: string; meta: GAS_Property_Meta }[]>();

/**
 * @GAS_Property 装饰器工厂
 * @param meta 元数据对象, 必须包含type字段, e.g., { type: Unit }
 */
export function GAS_Property<T extends IGAS_Ref>(meta: GAS_Property_Meta): (target: T, propertyName: string) => void {
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
        constructor.__gas_property_metadata__.set(propertyName, meta);

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
                            meta
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
export function GAS_State<T extends GASConstructor>(constructor: T): T {
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

    const WrappedClass = class extends (constructor as any) {
        private _gas_sync_enabled = false;

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
            
            // 从类的静态属性获取属性列表
            const propertiesToSync = (this.constructor as any).__gas_ordered_properties__;
            
            if (propertiesToSync) {
                world.syncer.on_self_state_changed({
                    type: GAS_SyncEventType.FULL_SYNC,
                    target: this,
                });
            }
        }

        /**
         * 获取类的GAS属性列表
         */
        static getGASProperties(): { propName: string; meta: GAS_Property_Meta }[] {
            return this.__gas_ordered_properties__ || [];
        }

        /**
         * 获取类的GAS属性元数据
         */
        static getGASPropertyMetadata(): Map<string, GAS_Property_Meta> {
            return this.__gas_property_metadata__ || new Map();
        }

        /**
         * 获取类的GAS属性名列表
         */
        static getGASPropertyNames(): string[] {
            return this.__gas_property_names__ || [];
        }

        /**
         * 检查是否为GAS类
         */
        static isGASClass(): boolean {
            return !!(this.__gas_ordered_properties__);
        }
    };

    // 将预收集的属性保存到类的静态属性
    (WrappedClass as any).__gas_ordered_properties__ = orderedProperties;
    // 保留原有的属性信息
    (WrappedClass as any).__gas_property_metadata__ = finalMetaMap;
    (WrappedClass as any).__gas_property_names__ = Array.from(seenProperties);

    return WrappedClass as unknown as T;
}