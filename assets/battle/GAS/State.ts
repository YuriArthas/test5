import { ExtractInitDataType, World, WorldRole } from "./World";
import { Player, GAS_Node } from "./Unit";


export enum GAS_Visible_Police {
    None = 0,
    Owner = 1,
    Allies = 2,
    Enemies = 4,
    All = Owner | Allies | Enemies,
}

export interface IGAS_Class_Meta {
    readonly state_meta: GAS_State_Meta;
    readonly gas_property_names: string[];
    readonly gas_property_metadata: Map<string, GAS_Property_Meta>;
    readonly gas_ordered_properties: { propName: string; meta: GAS_Property_Meta }[];
    
    getProperty(name: string): Readonly<GAS_Property_Meta> | undefined;
    hasProperty(name: string): boolean;
    readonly propertyCount: number;
    readonly isGASClass: boolean;
    readonly class_visible_police: GAS_Visible_Police;
}

export interface IGAS_Object {
    readonly world: World;
    readonly gas_id: number;
    get valid(): boolean;
    owner: GAS_Object;
    owner_player: Player;

    readonly role: WorldRole;

    syncGASState(): void;

    destory?(): void;
    _destory?(): void;

    visible_police: GAS_Visible_Police;
    
    /**
     * 类元数据访问器 (只有被@GAS_State装饰的类才有)
     */
    readonly CLASS_META: IGAS_Class_Meta;
}


export type GASConstructor = (new (...args: any[]) => IGAS_Object);

/**
 * 内部注册表，存储原始属性名
 */
const propertyNamesRegistry = new Map<any, string[]>();

/**
 * 内部注册表，存储属性元数据
 */
const propertyMetadataRegistry = new Map<any, Map<string, GAS_Property_Meta>>();


@GAS_State
export class GAS_Object implements IGAS_Object {
    world: World;

    gas_id: number;

    get role(): WorldRole {
        return this.world.role;
    }

    syncGASState() {}

    get visible_police(): GAS_Visible_Police {
        return this.CLASS_META.class_visible_police & this.local_visible_police;
    }

    local_visible_police: GAS_Visible_Police = GAS_Visible_Police.All;

    get owner_player(): Player {
        return this.world.owner_player;
    }

    owner: GAS_Object;

    get valid(): boolean {
        return this.world.is_ref_valid(this);
    }

    get CLASS_META(): IGAS_Class_Meta {return undefined;}  // 将使用GAS_State装饰器来设置CLASS_META

    constructor(owner: GAS_Object, gas_id: number) {
        this.gas_id = gas_id?? owner.world.apply_id();
        this.owner = owner;
        this.world = owner.world;
        this.world.add_id_state(this, true);
    }

    init(init_data: any) {

    }

    event_init_finish(): void {

    }

    create_object<T extends new (owner: GAS_Object, gas_id: number) => GAS_Object, InitData extends ExtractInitDataType<T>>(ObjectClass: T, init_data: InitData): InstanceType<T> {
        const obj = new ObjectClass(this, this.world.apply_id());  // add_id_state会自动在ObjectClass的构造函数里调用
        obj.syncGASState();
        obj.init(init_data);
        if(this.role == WorldRole.Server){
            obj.rpc_notify("event_init_finish");
        }
        return obj as InstanceType<T>;
    }

    create_map<K, V>(): GAS_Map<K, V> {
        const map = new GAS_Map<K, V>(this, this.world.apply_id());
        map.syncGASState();
        return map;
    }

    create_set<T>(): GAS_Set<T> {
        const set = new GAS_Set<T>(this, this.world.apply_id());
        set.syncGASState();
        return set;
    }

    create_array<T>(): GAS_Array<T> {
        const array = new GAS_Array<T>(this, this.world.apply_id());
        array.syncGASState();
        return array;
    }

    rpc_request(method_name: string, data?: any, callback?: (data: any) => void) {
        const event: GAS_RPC_CallEvent = {
            type: GAS_SyncEventType.RPC_CALL,
            target: this,
            request_id: this.world.apply_rpc_request_id(),
            method_name: method_name,
            data: data,
            callback: callback,
        };
        this.world.syncer.on_self_state_changed(event);
    }

    rpc_notify(method_name: string, data?: any) {
        const event: GAS_PRC_NotifyEvent = {
            type: GAS_SyncEventType.PRC_Notify,
            target: this,
            method_name: method_name,
            data: data,
        };
        this.world.syncer.on_self_state_changed(event);
    }

    _destory(): void{

    }

    destory(): void {
        this._destory();
        this.world.remove_id_state(this);
        this.world.rpc_notify("_GAS_destory");
    }
}

// /**
//  * 定义了可以被 @GAS_State 装饰的类的契约。
//  * 实例必须能提供一个 get_world 方法。
//  */
// export interface IGASStateful{
//     new(world: World, gas_id: number, ...args: any[]): IGASStateful;
// };

export type GAS_Map_Init_Data<K, V> = readonly (readonly [K, V])[];

@GAS_State
export class GAS_Map<K, V> extends GAS_Object {
    private map: Map<K, V>;
    private _gas_sync_enabled = false;

    constructor(owner: GAS_Object, gas_id: number) {
        super(owner, gas_id);
        this.map = new Map<K,V>();
    }

    init(init_data?: GAS_Map_Init_Data<K, V>) {
        if (init_data) {
            for (const [key, value] of init_data) {
                this.set(key, value);
            }
        }
    }

    set(key: K, value: V): this {
        const oldValue = this.map.get(key);
        this.map.set(key, value);
        
        if (this._gas_sync_enabled && oldValue !== value) {
            const world = this.world;
            if (world) {
                const event: GAS_PropertyChangedEvent = {
                    type: GAS_SyncEventType.PropertyChanged,
                    target: this,
                    propertyName: key,
                    op: GAS_PropertyChangedEventOperatorType.SET,
                    newValue: value
                };
                world.syncer.on_self_state_changed(event);
            }
        }
        
        return this;
    }

    delete(key: K): boolean {
        const had = this.map.has(key);
        const result = this.map.delete(key);
        
        if (this._gas_sync_enabled && had) {
            const world = this.world;
            if (world) {
                const event: GAS_PropertyChangedEvent = {
                    type: GAS_SyncEventType.PropertyChanged,
                    target: this,
                    propertyName: key,
                    op: GAS_PropertyChangedEventOperatorType.REMOVE,
                };
                world.syncer.on_self_state_changed(event);
            }
        }
        
        return result;
    }

    public syncGASState(): void {
        if (this._gas_sync_enabled) {
            return;
        }
        this._gas_sync_enabled = true;

        const world: World = this.world;
        if (!world) {
            return;
        }

        const event: GAS_FullSyncEvent = {
            type: GAS_SyncEventType.FULL_SYNC,
            target: this,
        };
        world.syncer.on_self_state_changed(event);
    }
    
    get(key: K): V | undefined {
        return this.map.get(key);
    }

    has(key: K): boolean {
        return this.map.has(key);
    }

    clear(): void {
        const hadItems = this.map.size > 0;
        this.map.clear();
        if (this._gas_sync_enabled && hadItems) {
            const world = this.world;
            const event: GAS_ClearEvent = {
                type: GAS_SyncEventType.CLEAR,
                target: this,
            };
            world.syncer.on_self_state_changed(event);
        }
    }

    get size(): number {
        return this.map.size;
    }

    keys(): IterableIterator<K> {
        return this.map.keys();
    }

    values(): IterableIterator<V> {
        return this.map.values();
    }

    entries(): IterableIterator<[K, V]> {
        return this.map.entries();
    }

    forEach(callbackfn: (value: V, key: K, map: this) => void, thisArg?: any): void {
        this.map.forEach((value, key) => {
            callbackfn.call(thisArg, value, key, this);
        });
    }

    [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.map.entries();
    }
}

@GAS_State
export class GAS_Set<T> extends GAS_Object {
    private set: Set<T>;
    private _gas_sync_enabled = false;

    constructor(owner: GAS_Object, gas_id: number) {
        super(owner, gas_id);
        this.set = new Set<T>();
    }

    init(init_data?: readonly T[] | null) {
        if (init_data) {
            for (const item of init_data) {
                this.add(item);
            }
        }
    }

    add(value: T): this {
        if (!this.set.has(value)) {
            this.set.add(value);
            if (this._gas_sync_enabled) {
                const event: GAS_PropertyChangedEvent = {
                    type: GAS_SyncEventType.PropertyChanged,
                    target: this,
                    op: GAS_PropertyChangedEventOperatorType.INSERT,
                    newValue: value,
                };
                this.world.syncer.on_self_state_changed(event);
            }
        }
        return this;
    }

    delete(value: T): boolean {
        if (this.set.has(value)) {
            this.set.delete(value);
            if (this._gas_sync_enabled) {
                const event: GAS_PropertyChangedEvent = {
                    type: GAS_SyncEventType.PropertyChanged,
                    target: this,
                    op: GAS_PropertyChangedEventOperatorType.REMOVE,
                    newValue: value,
                };
                this.world.syncer.on_self_state_changed(event);
            }
            return true;
        }
        return false;
    }

    clear(): void {
        const hadItems = this.set.size > 0;
        this.set.clear();
        if (this._gas_sync_enabled && hadItems) {
            const world = this.world;
            const event: GAS_ClearEvent = {
                type: GAS_SyncEventType.CLEAR,
                target: this,
            };
            world.syncer.on_self_state_changed(event);
        }
    }

    public syncGASState(): void {
        if (this._gas_sync_enabled) {
            return;
        }
        this._gas_sync_enabled = true;
    
        const world: World = this.world;
        if (!world) {
            return;
        }
    
        const event: GAS_FullSyncEvent = {
            type: GAS_SyncEventType.FULL_SYNC,
            target: this,
        };
        world.syncer.on_self_state_changed(event);
    }
    
    has(value: T): boolean {
        return this.set.has(value);
    }

    get size(): number {
        return this.set.size;
    }

    values(): IterableIterator<T> {
        return this.set.values();
    }

    keys(): IterableIterator<T> {
        return this.set.keys();
    }

    entries(): IterableIterator<[T, T]> {
        return this.set.entries();
    }

    forEach(callbackfn: (value: T, value2: T, set: this) => void, thisArg?: any): void {
        this.set.forEach((value, value2) => {
            callbackfn.call(thisArg, value, value2, this);
        });
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this.set.values();
    }
}

@GAS_State
export class GAS_Array<T> extends GAS_Object {
    private array: T[];
    private _gas_sync_enabled = false;

    constructor(owner: GAS_Object, gas_id: number) {
        super(owner, gas_id);
        this.array = [];
    }
    
    get length(): number {
        return this.array.length;
    }

    set(index: number, value: T) {
        const old_value = this.array[index];
        this.array[index] = value;

        if (this._gas_sync_enabled && old_value !== value) {
            const world = this.world;
            if (world) {
                const event: GAS_PropertyChangedEvent = {
                    type: GAS_SyncEventType.PropertyChanged,
                    target: this,
                    propertyName: index,
                    op: GAS_PropertyChangedEventOperatorType.SET,
                    newValue: value
                };
                world.syncer.on_self_state_changed(event);
            }
        }
    }

    at(index: number): T | undefined {
        return this.array[index];
    }

    public syncGASState(): void {
        if (this._gas_sync_enabled) {
            return;
        }
        this._gas_sync_enabled = true;

        const world: World = this.world;
        if (!world) {
            return;
        }

        const event: GAS_FullSyncEvent = {
            type: GAS_SyncEventType.FULL_SYNC,
            target: this,
        };
        world.syncer.on_self_state_changed(event);
    }

    push(...items: T[]): number {
        const start_index = this.array.length;
        const result = this.array.push(...items);
        if (this._gas_sync_enabled && items.length > 0) {
            const world = this.world;
            const event: GAS_PropertyChangedEvent = {
                type: GAS_SyncEventType.PropertyChanged,
                target: this,
                op: GAS_PropertyChangedEventOperatorType.SPLICE,
                propertyName: start_index,
                deleteCount: 0,
                inserted: items,
            };
            world.syncer.on_self_state_changed(event);
        }
        return result;
    }

    pop(): T | undefined {
        const had_items = this.array.length > 0;
        const result = this.array.pop();
        if (this._gas_sync_enabled && had_items) {
            const world = this.world;
            const event: GAS_PropertyChangedEvent = {
                type: GAS_SyncEventType.PropertyChanged,
                target: this,
                op: GAS_PropertyChangedEventOperatorType.SPLICE,
                propertyName: this.array.length,
                deleteCount: 1,
                inserted: [],
            };
            world.syncer.on_self_state_changed(event);
        }
        return result;
    }

    splice(start: number, deleteCount?: number, ...items: T[]): T[] {
        const actual_delete_count = deleteCount === undefined ? this.array.length - start : deleteCount;
        const result = this.array.splice(start, deleteCount, ...items);

        if (this._gas_sync_enabled && (actual_delete_count > 0 || items.length > 0)) {
            const world = this.world;
            const event: GAS_PropertyChangedEvent = {
                type: GAS_SyncEventType.PropertyChanged,
                target: this,
                op: GAS_PropertyChangedEventOperatorType.SPLICE,
                propertyName: start,
                deleteCount: actual_delete_count,
                inserted: items,
            };
            world.syncer.on_self_state_changed(event);
        }
        return result;
    }

    shift(): T | undefined {
        const had_items = this.array.length > 0;
        const result = this.array.shift();
        if (this._gas_sync_enabled && had_items) {
            const world = this.world;
            const event: GAS_PropertyChangedEvent = {
                type: GAS_SyncEventType.PropertyChanged,
                target: this,
                op: GAS_PropertyChangedEventOperatorType.SPLICE,
                propertyName: 0,
                deleteCount: 1,
                inserted: [],
            };
            world.syncer.on_self_state_changed(event);
        }
        return result;
    }

    unshift(...items: T[]): number {
        const result = this.array.unshift(...items);
        if (this._gas_sync_enabled && items.length > 0) {
            const world = this.world;
            const event: GAS_PropertyChangedEvent = {
                type: GAS_SyncEventType.PropertyChanged,
                target: this,
                op: GAS_PropertyChangedEventOperatorType.SPLICE,
                propertyName: 0,
                deleteCount: 0,
                inserted: items,
            };
            world.syncer.on_self_state_changed(event);
        }
        return result;
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this.array[Symbol.iterator]();
    }
}

export type GAS_StateValue = (new (...args: any[]) => IGAS_Object) | NumberConstructor | StringConstructor | BooleanConstructor;

/**
 * GAS属性的元数据类型定义。
 * type: 属性的构造函数，可以是类，也可以是Number, String等原生类型。
 */
export interface GAS_Property_Meta_Input {
    type: GAS_StateValue;
    extra_types?: GAS_StateValue[];
    ref?: boolean;
}

export interface GAS_Property_Meta extends GAS_Property_Meta_Input {
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

    RPC_CALL,
    RPC_RESULT,
    PRC_Notify,
}

export enum GAS_PropertyChangedEventOperatorType {
    SET = 0,
    INSERT = 1,
    REMOVE = 2,
    SPLICE = 3,
}

export interface GAS_SyncEvent {
    type: GAS_SyncEventType;
    
}

export interface GAS_CustomEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.CustomEvent;
    event_name: string;
    event_data: any;
}

/**
 * 属性变化事件
 */
export interface GAS_PropertyChangedEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.PropertyChanged;
    target: IGAS_Object;
    propertyName?: any;
    op?: GAS_PropertyChangedEventOperatorType;  // 操作类型，默认为SET
    newValue?: any;
    deleteCount?: number;
    inserted?: any[];
}

export interface GAS_CreateStateEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.CreateState;
    target: IGAS_Object;
}

export interface GAS_RemoveStateEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.RemoveState;
    target: IGAS_Object;
}

export interface GAS_FullSyncEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.FULL_SYNC;
    target: IGAS_Object;
}

export interface GAS_ClearEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.CLEAR;
    target: IGAS_Object;
}

export interface GAS_LogicFrameEndEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.LogicFrameEnd;
    frame: number;
}

export interface GAS_SyncFrameEndEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.SyncFrameEnd;
    frame: number;
}

export interface GAS_RPC_CallEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.RPC_CALL;
    request_id: number;
    target: GAS_Object;
    method_name: string;
    data?: any;
    callback?: (data: any) => void;
}

export interface GAS_RPC_ResultEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.RPC_RESULT;
    request_id: number;
    data?: any;
}

export interface GAS_PRC_NotifyEvent extends GAS_SyncEvent {
    type: GAS_SyncEventType.PRC_Notify;
    target: IGAS_Object;
    method_name: string;
    data?: any;
}
/**
 * @GAS_Property 装饰器工厂
 */
export function GAS_Property<T extends IGAS_Object>(property_meta_input: GAS_Property_Meta_Input| GAS_StateValue): (target: T, propertyName: string) => void {
    return function (prototype: any, propertyName: string) {
        const constructor = prototype.constructor;

        if(typeof property_meta_input === "function") {
            property_meta_input = {type: property_meta_input};
        }

        // 创建新的、完整的元数据对象，而不是修改输入的对象
        const property_meta: GAS_Property_Meta = {
            ...property_meta_input,
            name: propertyName,
        };
        
        // 1. 注册原始属性名到内部注册表
        if (!propertyNamesRegistry.has(constructor)) {
            propertyNamesRegistry.set(constructor, []);
        }
        const properties = propertyNamesRegistry.get(constructor)!;
        if (properties.indexOf(propertyName) === -1) {
            properties.push(propertyName);
        }

        // 2. 存储元数据到内部注册表
        if (!propertyMetadataRegistry.has(constructor)) {
            propertyMetadataRegistry.set(constructor, new Map<string, GAS_Property_Meta>());
        }
        propertyMetadataRegistry.get(constructor)!.set(propertyName, property_meta);

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
                        const event: GAS_PropertyChangedEvent = {
                            type: GAS_SyncEventType.PropertyChanged,
                            target: this,
                            propertyName,
                            newValue,
                        };
                        world.syncer.on_self_state_changed(event);
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
    }
}

export interface GAS_PropertyMap_Meta_Input {
    map_type?: typeof GAS_Map;
    key_type: GAS_StateValue;
    value_type: GAS_StateValue;
    ref?: boolean;
    visible_police?: GAS_Visible_Police;
}

export function GAS_Property_Map<T extends IGAS_Object>(property_meta_input: GAS_PropertyMap_Meta_Input): (target: T, propertyName: string) => void {
    const input: GAS_Property_Meta_Input = {
        type: property_meta_input.map_type?? GAS_Map,
        extra_types: [property_meta_input.key_type, property_meta_input.value_type],
        ref: property_meta_input.ref,
    }
    return GAS_Property(input);
}

export interface GAS_PropertyArray_Meta_Input {
    array_type?: typeof GAS_Array;
    item_type: GAS_StateValue;
    ref?: boolean;
}

export function GAS_Property_Array<T extends IGAS_Object>(property_meta_input: GAS_PropertyArray_Meta_Input): (target: T, propertyName: string) => void {
    const input: GAS_Property_Meta_Input = {
        type: property_meta_input.array_type?? GAS_Array,
        extra_types: [property_meta_input.item_type],
        ref: property_meta_input.ref,
    }
    return GAS_Property(input);
}

export function GAS_Ref<T extends IGAS_Object>(property_meta_input: GAS_Property_Meta_Input): (target: T, propertyName: string) => void {
    return GAS_Property({
        ...property_meta_input,
        ref: true,
    });
}



export interface GAS_State_Meta_Input {
    client_class_name?: string;
    visible_police?: GAS_Visible_Police;
}

export interface GAS_State_Meta extends GAS_State_Meta_Input {
    visible_police: GAS_Visible_Police;
}

/**
 * @GAS_State 装饰器
 */
export function GAS_State(arg1?: GAS_State_Meta_Input | (new (...args: any[]) => IGAS_Object)): any {
    const decorator = function <T extends new (...args: any[]) => IGAS_Object>(constructor: T, state_meta_input?: GAS_State_Meta_Input): T {
        const state_meta: GAS_State_Meta = { ...state_meta_input, visible_police: state_meta_input?.visible_police?? GAS_Visible_Police.All };

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
        const finalMetaMap = new Map<string, GAS_Property_Meta>();
        for (const proto of prototypeChain) {
            const ctor = proto.constructor;
            const metaOnThisLevel = propertyMetadataRegistry.get(ctor);
            if (metaOnThisLevel) {
                for (const [propName, meta] of metaOnThisLevel.entries()) {
                    finalMetaMap.set(propName, meta);
                }
            }
        }

        // 2. 按照父->子顺序，构建最终的有序列表
        for (const proto of prototypeChain) {
            const ctor = proto.constructor;
            const propsOnThisLevel = propertyNamesRegistry.get(ctor) || [];
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
        const classMeta: IGAS_Class_Meta = {
            state_meta,
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
            },

            class_visible_police: state_meta.visible_police,
        };

        const WrappedClass = class extends (constructor as any) {
            private _gas_sync_enabled = false;

            // 类元数据访问器 - 返回预创建的闭包
            get CLASS_META() {
                return classMeta;
            }

            // constructor(...args: any[]) {
            //     super(...args);
            // }
            
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
                    const event: GAS_FullSyncEvent = {
                        type: GAS_SyncEventType.FULL_SYNC,
                        target: this as any as IGAS_Object,
                    };
                    world.syncer.on_self_state_changed(event);
                }
            }
        };

        return WrappedClass as unknown as T;
    };

    if (typeof arg1 === 'function') {
        return decorator(arg1 as any);
    }

    return <T extends new (...args: any[]) => IGAS_Object>(constructor: T) => decorator(constructor, arg1);
}