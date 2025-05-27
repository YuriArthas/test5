import { assert } from "cc";
import { GAS_AbilitySystem as GAS_AbilitySystem } from "./AbilitySystemComponent";




type 属性Modifier_op = "add" | "mul" | "min" | "max" | "set" | "mul_mul" | "add_add";

type type属性构造函数 = new () => Attr;
type type属性创建Factory = {
    constructor_func: type属性构造函数;
    base_value: number;
    max_attr_name: string;
    min_attr_name: string;
}

export class 属性静态注册器 {
    static 注册(name: string, 构造函数: type属性构造函数, base_value: number = 0, max_attr_name: string = undefined, min_attr_name: string = undefined) {
        if(属性静态注册器.属性构造Map.has(name)) {
            throw new Error(`属性 ${name} 已存在`);
        }
        属性静态注册器.属性构造Map.set(name, {constructor_func: 构造函数, base_value: base_value, max_attr_name: max_attr_name, min_attr_name: min_attr_name});
    }

    static 获取(name: string): type属性创建Factory {
        if(属性静态注册器.属性构造Map.has(name)) {
            return 属性静态注册器.属性构造Map.get(name);
        }
        throw new Error(`属性 ${name} 不存在`);
    }

    static 创建(name: string, 管理器: GAS_AbilitySystem, base_value: number = undefined): Attr {
        const 工厂 = 属性静态注册器.获取(name);
        if(工厂 === undefined) {
            throw new Error(`属性 ${name} 不存在`);
        }

        if(base_value === undefined) {
            base_value = 工厂.base_value;
            if(base_value === undefined) {
                base_value = 0;
            }
        }

        const attr = new 工厂.constructor_func();
        if(!管理器) {
            attr._GAS = 管理器;
        }
        attr.base_value = base_value;
        if(工厂.max_attr_name){
            const max_attr = 管理器.get_attr(工厂.max_attr_name, false);
            assert(max_attr !== undefined, `属性 ${工厂.max_attr_name} 不存在`);
            attr.add_modifier(max_attr);
        }
        if(工厂.min_attr_name){
            const min_attr = 管理器.get_attr(工厂.min_attr_name, false);
            assert(min_attr !== undefined, `属性 ${工厂.min_attr_name} 不存在`);
            attr.add_modifier(min_attr);
        }
        return attr;
    }

    static 属性构造Map: Map<string, type属性创建Factory> = new Map();
}

export class Attr {
    _GAS: GAS_AbilitySystem;
    _dirty_publisher_array?: Attr[];
    _dirty_subscriber_array?: Attr[];
    protected _modifier_list?: Attr[];
    _modifiler_op: 属性Modifier_op;

    _dirty: boolean = true;
    _base_value: number = 0;
    _final_value: number = 0;
    _min_value: number;
    _max_value: number;
    protected dirty_event_list: ((attr: Attr, old_value: number) => void)[] = undefined;

    subscribe_dirty_change(obj: Attr): void {
        if(this._dirty_subscriber_array === undefined) {
            this._dirty_subscriber_array = [];
        }
        this._dirty_subscriber_array.push(obj);

        if(obj._dirty_publisher_array === undefined){
            obj._dirty_publisher_array = [];
        }
        obj._dirty_publisher_array.push(this);
    }
    unsubscribe_dirty_change(obj: Attr): void {
        // 从当前对象的订阅者数组中移除 obj
        if(this._dirty_subscriber_array !== undefined) {
            const index = this._dirty_subscriber_array.indexOf(obj);
            assert(index !== -1, "unsubscribe_dirty_change: 在当前对象的订阅者数组中找不到目标对象");
            this._dirty_subscriber_array.splice(index, 1);
            if(this._dirty_subscriber_array.length === 0) {
                this._dirty_subscriber_array = undefined;
            }
        } else {
            assert(false, "unsubscribe_dirty_change: 当前对象没有订阅者数组");
        }

        // 从 obj 的发布者数组中移除当前对象
        if(obj._dirty_publisher_array !== undefined) {
            const index = obj._dirty_publisher_array.indexOf(this);
            assert(index !== -1, "unsubscribe_dirty_change: 在目标对象的发布者数组中找不到当前对象");
            obj._dirty_publisher_array.splice(index, 1);
            if(obj._dirty_publisher_array.length === 0) {
                obj._dirty_publisher_array = undefined;
            }
        } else {
            assert(false, "unsubscribe_dirty_change: 目标对象没有发布者数组");
        }
    }

    disconnect_all_dirty_pubsub(): void {
        // 断开所有订阅者关系
        if(this._dirty_subscriber_array !== undefined) {
            for(let subscriber of this._dirty_subscriber_array) {
                // 从订阅者的发布者数组中移除当前对象
                assert(subscriber._dirty_publisher_array !== undefined, "disconnect_all_dirty_pubsub: 订阅者没有发布者数组");
                const index = subscriber._dirty_publisher_array.indexOf(this);
                assert(index !== -1, "disconnect_all_dirty_pubsub: 在订阅者的发布者数组中找不到当前对象");
                subscriber._dirty_publisher_array.splice(index, 1);
                if(subscriber._dirty_publisher_array.length === 0) {
                    subscriber._dirty_publisher_array = undefined;
                }
            }
            this._dirty_subscriber_array = undefined;
        }

        // 断开所有发布者关系
        if(this._dirty_publisher_array !== undefined) {
            for(let publisher of this._dirty_publisher_array) {
                // 从发布者的订阅者数组中移除当前对象
                assert(publisher._dirty_subscriber_array !== undefined, "disconnect_all_dirty_pubsub: 发布者没有订阅者数组");
                const index = publisher._dirty_subscriber_array.indexOf(this);
                assert(index !== -1, "disconnect_all_dirty_pubsub: 在发布者的订阅者数组中找不到当前对象");
                publisher._dirty_subscriber_array.splice(index, 1);
                if(publisher._dirty_subscriber_array.length === 0) {
                    publisher._dirty_subscriber_array = undefined;
                }
            }
            this._dirty_publisher_array = undefined;
        }
    }

    to_dirty(trigger_dirty_event: boolean): void {
        if(this._dirty == true) {
            return;
        }

        const dirty_list: [Attr, number][] = [];
        Attr._dirty_and_collect(dirty_list, this);

        if(trigger_dirty_event) {
            for(let [elem, old_value] of dirty_list) {
                if(elem.dirty_event_list) {
                    for(let event of elem.dirty_event_list) {
                        event(elem, old_value);
                    }
                }
            }
        }
    }

    get dirty(): boolean {
        return this._dirty;
    }

    get value(): number {
        if(this._dirty) {
            this.do_refresh_value();
        }
        return this._final_value;
    }

    calc_self(): number {
        let ret = this._base_value;

        let mul = 1;
        let mul_mul = 1;
        
        if(this._modifier_list !== undefined) {
            for(let modifier of this._modifier_list) {
                if(modifier.modifier_op === "add") {
                    ret += modifier.value;
                }else if(modifier.modifier_op === "mul") {
                    mul += modifier.value;
                }else if(modifier.modifier_op === "min") {
                    this._min_value = modifier.value;
                }else if(modifier.modifier_op === "max") {
                    this._max_value = modifier.value;
                }else if(modifier.modifier_op === "set") {
                    this._base_value = modifier.value;
                }else if(modifier.modifier_op === "mul_mul") {
                    mul_mul *= modifier.value;
                }else{
                    assert(false, "属性Modifier_op 未实现");
                }
            }
        }

        return ret * mul * mul_mul;
    }

    do_refresh_value() {
        this._final_value = this.calc_self();

        if(this._min_value !== undefined) {
            this._final_value = Math.max(this._final_value, this._min_value);
        }

        if(this._max_value !== undefined) {
            this._final_value = Math.min(this._final_value, this._max_value);
        }

        this._dirty = false;
    }

    get base_value(): number {
        return this._base_value;
    }

    set base_value(v: number) {
        this._base_value = v;
        this.to_dirty(true);
    }

    get GAS(): GAS_AbilitySystem {
        return this._GAS;
    }

    get min_value(): number {
        return this._min_value?? -Infinity;
    }
    set min_value(v: number) {
        this._min_value = v;
        this.to_dirty(true);
    }

    get max_value(): number {
        return this._max_value?? Infinity;
    }
    set max_value(v: number) {
        this._max_value = v;
        this.to_dirty(true);
    }

    add_modifier(modifier: Attr): void {
        if(this._modifier_list === undefined) {
            this._modifier_list = [];
        }
        this._modifier_list.push(modifier);
        this.subscribe_dirty_change(modifier);
        this.to_dirty(true);
    }

    remove_modifier(modifier: Attr): void {
        if(this._modifier_list === undefined) {
            return;
        }
        this._modifier_list = this._modifier_list.filter(elem => elem !== modifier);
        this.unsubscribe_dirty_change(modifier);
        this.to_dirty(true);
    }

    protected static _dirty_and_collect(list: [Attr, number][], attr: Attr){
        attr._dirty = true;
        list.push([attr, attr._final_value]);

        if(attr._dirty_subscriber_array) {
            for(let elem of attr._dirty_subscriber_array) {
                if(elem._dirty == false) {
                    Attr._dirty_and_collect(list, elem);
                }
            }
        }
    }

    get source(): any {
        return undefined;
    }

    get modifier_op(): 属性Modifier_op {
        return this._modifiler_op?? "add";
    }
}



