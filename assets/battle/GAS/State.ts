import { World } from "./World";

export class GAS_WeakRef {

}

/**
 * GAS属性的元数据类型定义。
 * type: 属性的构造函数，可以是类，也可以是Number, String等原生类型。
 */
export interface GAS_Property_Meta {
    type: 
        GASStateful |
        Number | String | Boolean |
        Array<GAS_Property_Meta> |
        Map<string, GAS_Property_Meta> | Map<number, GAS_Property_Meta> |
        Set<GAS_Property_Meta> |
        GAS_WeakRef;
}

export enum GAS_SyncEventType {
    CustomEvent,
    
    PropertyChanged,
    
    CreateState,
    RemoveState,

    
    LogicFrameEnd,
    SyncFrameEnd,
}

export enum GAS_PropertyChangedEventOperatorType {
    SET = 0,
    INSERT = 1,
    REMOVE = 2,
    
}

export interface GAS_SyncEvent {
    type: GAS_SyncEventType;
}

/**
 * 属性变化事件
 */
export interface GAS_PropertyChangedEvent extends GAS_SyncEvent {
    target: any;
    propertyName: string|number;
    op?: GAS_PropertyChangedEventOperatorType;  // 操作类型，默认为SET
    newValue: any;
    meta?: GAS_Property_Meta;
}

/**
 * 定义了可以被 @GAS_State 装饰的类的契约。
 * 实例必须能提供一个 get_world 方法。
 */
export interface GASStateful {
    world: World;
    gas_id: number;
};

/**
 * 临时存储每个类在定义时拥有的GAS属性名。
 */
const rawGasProperties = new Map<any, string[]>();

/**
 * 临时存储每个类在定义时拥有的GAS属性元数据。
 */
const gasPropertyMetadata = new Map<any, Map<string, any>>();

/**
 * 最终存储每个@GAS_State类预收集、排序好的属性列表。
 * 结构为: { propName: string; meta: any }[]
 */
const preCollectedGasProperties = new WeakMap<any, { propName: string; meta: GAS_Property_Meta }[]>();

/**
 * @GAS_Property 装饰器工厂
 * @param meta 元数据对象, 必须包含type字段, e.g., { type: Unit }
 */
export function GAS_Property(meta: GAS_Property_Meta): (target: any, propertyName: string) => void {
    return function (target: any, propertyName: string) {
        const constructor = target.constructor;
        
        // 1. 注册原始属性名
        if (!rawGasProperties.has(constructor)) {
            rawGasProperties.set(constructor, []);
        }
        const properties = rawGasProperties.get(constructor)!;
        if (properties.indexOf(propertyName) === -1) {
            properties.push(propertyName);
        }

        // 2. 存储元数据
        if (!gasPropertyMetadata.has(constructor)) {
            gasPropertyMetadata.set(constructor, new Map<string, any>());
        }
        gasPropertyMetadata.get(constructor)!.set(propertyName, meta);

        const privateKey = `_${propertyName}`;
    
        Object.defineProperty(target, propertyName, {
            get() {
                return this[privateKey];
            },
            set(newValue: any) {
                const oldValue = this[privateKey];
                this[privateKey] = newValue;

                const world = (this as any as GASStateful).world;
                // Check if the new value is a collection that needs to be made reactive.
                if (world && newValue && typeof newValue === 'object' && !(newValue as any).__is_reactive) {
                    
                    const isCollection = newValue instanceof Map || newValue instanceof Set || Array.isArray(newValue);

                    if (isCollection) {
                        // Mark as reactive to prevent re-wrapping.
                        (newValue as any).__is_reactive = true;

                        // Assign world and gas_id if it's a new collection to the system.
                        if ((newValue as any).world === undefined) {
                            (newValue as any).world = world;
                            const gas_id = world.id_counter++;
                            (newValue as any).gas_id = gas_id;
                            world.add_id_state(gas_id, newValue as any as GASStateful, true);
                        }
                        
                        const syncer = world.syncer;
                        const target_collection = newValue;

                        // --- Hijack Map methods ---
                        if (target_collection instanceof Map) {
                            const original_set = target_collection.set;
                            target_collection.set = function(key: any, value: any) {
                                const old_value_in_map = this.get(key);
                                const result = original_set.call(this, key, value);
                                if (old_value_in_map !== value) {
                                    syncer.on_self_state_changed({
                                        type: GAS_SyncEventType.PropertyChanged, target: this, propertyName: key,
                                        op: GAS_PropertyChangedEventOperatorType.SET, newValue: value
                                    });
                                }
                                return result;
                            };
                            const original_delete = target_collection.delete;
                            target_collection.delete = function(key: any) {
                                const had = this.has(key);
                                const result = original_delete.call(this, key);
                                if(had) {
                                    syncer.on_self_state_changed({
                                        type: GAS_SyncEventType.PropertyChanged, target: this, propertyName: key,
                                        op: GAS_PropertyChangedEventOperatorType.REMOVE, newValue: undefined
                                    });
                                }
                                return result;
                            }
                        } 
                        // --- Hijack Set methods ---
                        else if (target_collection instanceof Set) {
                            const original_add = target_collection.add;
                            target_collection.add = function(value: any) {
                                const had = this.has(value);
                                const result = original_add.call(this, value);
                                if (!had) {
                                        syncer.on_self_state_changed({
                                        type: GAS_SyncEventType.PropertyChanged, target: this, propertyName: value,
                                        op: GAS_PropertyChangedEventOperatorType.INSERT, newValue: value
                                    });
                                }
                                return result;
                            };
                            const original_delete = target_collection.delete;
                                target_collection.delete = function(value: any) {
                                const had = this.has(value);
                                const result = original_delete.call(this, value);
                                if (had) {
                                        syncer.on_self_state_changed({
                                        type: GAS_SyncEventType.PropertyChanged, target: this, propertyName: value,
                                        op: GAS_PropertyChangedEventOperatorType.REMOVE, newValue: value
                                    });
                                }
                                return result;
                            };
                        }
                        // --- Hijack Array methods ---
                        else if (Array.isArray(target_collection)) {
                            const methodsToPatch = ['push', 'pop', 'shift', 'unshift', 'splice'];
                            methodsToPatch.forEach(methodName => {
                                const originalMethod = target_collection[methodName];
                                target_collection[methodName] = function(...args: any[]) {
                                    const oldArray = [...this];
                                    const result = originalMethod.apply(this, args);
                                    
                                    // For simplicity, we trigger a generic change event on the array for any mutation.
                                    // A more complex implementation could diff the array states.
                                    syncer.on_self_state_changed({
                                        type: GAS_SyncEventType.PropertyChanged, target: this, propertyName: methodName,
                                        op: GAS_PropertyChangedEventOperatorType.SET, newValue: this // Send the whole array
                                    });

                                    return result;
                                };
                            });
                        }
                    }
                }

                if ((this as any)._gas_sync_enabled && oldValue !== newValue) {
                    const world = (this as any as GASStateful).world;
                    if (world) {
                        world.syncer.on_self_state_changed({
                            type: GAS_SyncEventType.PropertyChanged,
                            target: this,
                            propertyName,
                            newValue,
                            meta // 在setter中直接使用闭包捕获的meta
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
export function GAS_State<T extends { new(...args: any[]): GASStateful }>(constructor: T) {
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
        const metaOnThisLevel = gasPropertyMetadata.get(ctor);
        if (metaOnThisLevel) {
            for (const [propName, meta] of metaOnThisLevel.entries()) {
                finalMetaMap.set(propName, meta);
            }
        }
    }

    // 2. 按照父->子顺序，构建最终的有序列表
    for (const proto of prototypeChain) {
        const ctor = proto.constructor;
        const propsOnThisLevel = rawGasProperties.get(ctor) || [];
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
    
    preCollectedGasProperties.set(constructor, orderedProperties);
    // --- 预收集结束 ---

    return class extends constructor {
        private _gas_sync_enabled = false;

        constructor(...args: any[]) {
            super(...args);
            if(this.gas_id === undefined) {
                this.gas_id = this.world.id_counter++;
                this.world.add_id_state(this.gas_id, this, true);
            }
        }
        
        /**
         * 首次调用时，会同步所有预收集的GAS属性，并开启后续的自动变更通知。
         */
        public syncGASState(): void {
            if (!this._gas_sync_enabled) {
                this._gas_sync_enabled = true;
            }

            const world = this.world;
            if (!world) {
                return;
            }
            
            // 直接获取预收集的属性数组
            const propertiesToSync = preCollectedGasProperties.get(this.constructor);
            
            if (propertiesToSync) {
                for (const prop of propertiesToSync) {
                    world.syncer.on_self_state_changed({
                        type: GAS_SyncEventType.PropertyChanged,
                        target: this,
                        propertyName: prop.propName,
                        newValue: (this as any)[prop.propName],
                        meta: prop.meta
                    });
                }
            }
        }
    };
}
