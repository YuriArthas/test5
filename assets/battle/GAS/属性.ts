import { assert } from "cc";
import { ASC as ASC } from "./AbilitySystemComponent";


export class AttrOperator {
    value: Attr;
    op: AttrOperatorType;

    constructor(op: AttrOperatorType, value: Attr) {
        this.value = value;
        this.op = op;
    }
}


export type AttrOperatorType = "add" | "mul" | "set" | "mul_mul" | "add_add";

type type属性构造函数 = new (base_value: number, asc?: ASC) => Attr;
type type属性创建Factory = {
    constructor_func: type属性构造函数;
    base_value: number;
}

export class 属性静态注册器 {
    static 注册(name: string, base_value: number = 0, 构造函数: type属性构造函数 = undefined) {
        if(属性静态注册器.属性构造Map.has(name)) {
            throw new Error(`属性 ${name} 已存在`);
        }
        属性静态注册器.属性构造Map.set(name, {constructor_func: 构造函数?? Attr, base_value: base_value});
    }

    static 获取(name: string): type属性创建Factory {
        if(属性静态注册器.属性构造Map.has(name)) {
            return 属性静态注册器.属性构造Map.get(name);
        }
        throw new Error(`属性 ${name} 不存在`);
    }

    static 创建(name: string, 管理器: ASC, base_value: number = undefined): Attr {
        let 工厂 = 属性静态注册器.获取(name);
        if(工厂 === undefined) {
            工厂 = {
                constructor_func: Attr,
                base_value: 0
            };
        }

        if(base_value === undefined) {
            base_value = 工厂.base_value;
            if(base_value === undefined) {
                base_value = 0;
            }
        }

        const attr = new 工厂.constructor_func(base_value, 管理器);
        return attr;
    }

    static 属性构造Map: Map<string, type属性创建Factory> = new Map();
}

export class Attr {
    asc: ASC;
    _dirty_publisher_array?: Attr[];
    _dirty_subscriber_array?: Attr[];
    protected _attr_operator_list?: AttrOperator[];

    _dirty: boolean = true;
    _base_value: number;
    _final_value: number;
    _min_attr: Attr;
    _max_attr: Attr;

    constructor(base_value: number, asc?: ASC) {
        this._base_value = base_value;
        if(asc) {
            this.asc = asc;
        }
    }

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
        
        if(this._attr_operator_list !== undefined) {
            for(let attr_operator of this._attr_operator_list) {
                if(attr_operator.op === "add") {
                    ret += attr_operator.value.value;
                }else if(attr_operator.op === "mul") {
                    mul += attr_operator.value.value;
                }else if(attr_operator.op === "set") {
                    this._base_value = attr_operator.value.value;
                }else if(attr_operator.op === "mul_mul") {
                    mul_mul *= attr_operator.value.value;
                }else{
                    assert(false, `AttrOperatorType ${attr_operator.op} 未实现`);
                }
            }
        }

        return ret * mul * mul_mul;
    }

    do_refresh_value() {
        this._final_value = this.calc_self();

        if(this._min_attr !== undefined) {
            this._final_value = Math.max(this._final_value, this._min_attr.value);
        }

        if(this._max_attr !== undefined) {
            this._final_value = Math.min(this._final_value, this._max_attr.value);
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

    get ASC(): ASC {
        return this.asc;
    }

    get min_value(): number {
        return this._min_attr?.value?? -Infinity;
    }
    set min_value(attr: Attr) {
        if(this._min_attr) {
            this.unsubscribe_dirty_change(this._min_attr);
        }
        this._min_attr = attr;
        if(attr) {
            this.subscribe_dirty_change(attr);
        }
        this.to_dirty(true);
    }

    get max_value(): number {
        return this._max_attr?.value?? Infinity;
    }
    set max_value(attr: Attr) {
        if(this._max_attr) {
            this.unsubscribe_dirty_change(this._max_attr);
        }
        this._max_attr = attr;
        if(attr) {
            this.subscribe_dirty_change(attr);
        }
        this.to_dirty(true);
    }

    add_attr_operator(attr_operator: AttrOperator): void {
        if(this._attr_operator_list === undefined) {
            this._attr_operator_list = [];
        }
        this._attr_operator_list.push(attr_operator);
        this.subscribe_dirty_change(attr_operator.value);
        this.to_dirty(true);
    }

    remove_attr_operator(attr_operator: AttrOperator): void {
        if(this._attr_operator_list === undefined) {
            assert(false, "remove_attr_operator: 当前对象没有属性操作符列表");
            return;
        }
        this._attr_operator_list = this._attr_operator_list.filter(elem => elem !== attr_operator);
        this.unsubscribe_dirty_change(attr_operator.value);
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
}


