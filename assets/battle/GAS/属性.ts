import { assert } from "cc";
import { ASC as ASC } from "./AbilitySystemComponent";


export class AttrOperator {
    value: BaseAttr;
    op: AttrOperatorType;

    constructor(op: AttrOperatorType, value: BaseAttr) {
        this.value = value;
        this.op = op;
    }
}


export type AttrOperatorType = "add" | "add_mul" | "set" | "mul_mul" ;

type type属性构造函数 = new (asc: ASC, formula?: AttrFormula, base_value?: number) => Attr;
type type属性创建Factory = {
    constructor_func?: type属性构造函数;
    base_value?: number;
    formula?: AttrFormula;
}

export class 属性静态注册器 {
    static 注册(name: string, factory: type属性创建Factory) {
        if(属性静态注册器.属性构造Map.has(name)) {
            throw new Error(`属性 ${name} 已存在`);
        }
        属性静态注册器.属性构造Map.set(name, factory);
    }

    static 获取(name: string): type属性创建Factory {
        if(属性静态注册器.属性构造Map.has(name)) {
            return 属性静态注册器.属性构造Map.get(name);
        }
        throw new Error(`属性 ${name} 不存在`);
    }

    static 创建(name: string, asc: ASC, base_value: number = undefined, formula: AttrFormula = undefined): Attr {
        let 工厂 = 属性静态注册器.获取(name);
        if(工厂 === undefined) {
            工厂 = {
                constructor_func: Attr,
                base_value: 0,
                formula: formula
            };
        }

        if(base_value === undefined) {
            base_value = 工厂.base_value;
            if(base_value === undefined) {
                base_value = 0;
            }
        }

        if(formula === undefined) {
            formula = 工厂.formula;
        }

        const attr = new 工厂.constructor_func(asc, formula, base_value);
        return attr;
    }

    static 属性构造Map: Map<string, type属性创建Factory> = new Map();
}

// 这个类以后有用
class AttrSourceCollection {

}


type AttrFomulaResult = [number, number, number];

type AttrFormula = (source_collection?: AttrSourceCollection) => Readonly<AttrFomulaResult>;

export class BaseAttr{
    protected _dirty_publisher_array?: BaseAttr[];
    protected _dirty_subscriber_array?: BaseAttr[];
    protected dirty_event_list: ((attr: BaseAttr, old_value: number) => void)[];

    _base_value: number = 0;
    _dirty: boolean = true;

    constructor(base_value: number = 0) {
        this._base_value = base_value;
    }

    value(): number {
        return this._base_value;
    }

    cached_value(): number {
        return this._base_value;
    }

    get base_value(): number {
        return this._base_value;
    }

    set base_value(v: number) {
        this._base_value = v;
        this.to_dirty(true);
    }

    protected static _dirty_and_collect(list: [BaseAttr, number][], attr: BaseAttr){
        attr._dirty = true;
        list.push([attr, attr.cached_value()]);

        if(attr._dirty_subscriber_array) {
            for(let elem of attr._dirty_subscriber_array) {
                if(elem._dirty == false) {
                    Attr._dirty_and_collect(list, elem);
                }
            }
        }
    }

    dirty(): boolean {
        return this._dirty;
    }

    to_dirty(trigger_dirty_event: boolean): void {
        if(this._dirty == true) {
            return;
        }

        const dirty_list: [BaseAttr, number][] = [];
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

    subscribe_dirty_change(obj: BaseAttr): void {
        if(this._dirty_subscriber_array === undefined) {
            this._dirty_subscriber_array = [];
        }
        this._dirty_subscriber_array.push(obj);

        if(obj._dirty_publisher_array === undefined){
            obj._dirty_publisher_array = [];
        }
        obj._dirty_publisher_array.push(this);
    }

    unsubscribe_dirty_change(obj: BaseAttr): void {
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

    disconnect_all_subscriber(): void {
        // 断开所有订阅者关系
        if(this._dirty_subscriber_array !== undefined) {
            for(let subscriber of [...this._dirty_subscriber_array]) {
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
    }

    disconnect_all_dirty_publisher(): void {
        // 断开所有发布者关系
        if(this._dirty_publisher_array !== undefined) {
            for(let publisher of [...this._dirty_publisher_array]) {
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

    disconnect_all_dirty_pubsub(): void {
        this.disconnect_all_subscriber();
        this.disconnect_all_dirty_publisher();
    }
}

export class Attr extends BaseAttr{
    asc: ASC;
    protected _attr_operator_list?: AttrOperator[];

    _base_add_mul: number = 0;
    _base_mul_mul: number = 1;
    _cached_result: Readonly<AttrFomulaResult> = undefined;
    _final_value: number = undefined;
    _formula: AttrFormula = undefined;
    _min_attr: BaseAttr;
    _max_attr: BaseAttr;


    constructor(asc: ASC, formula?: AttrFormula, base_value?: number) {
        super();
        this.asc = asc;
        this._formula = formula;
        if(base_value !== undefined) {
            this._base_value = base_value;
        }
        this._final_value = 0;
    }



    force_recalc_to_collect_sources(sources: AttrSourceCollection): void {
        this.do_refresh_value(sources);
    }

    value(): number {
        if(this._dirty) {
            this.do_refresh_value();
        }
        return this._final_value;
    }

    cached_value(): number {
        if(this._dirty) {
            this.do_refresh_value();
        }
        return this._final_value;
    }

    cached_result(): Readonly<AttrFomulaResult> {
        if(this._dirty) {
            this.do_refresh_value();
        }
        return this._cached_result;
    }

    calc_modifier(source_collection?: AttrSourceCollection): AttrFomulaResult {
        let plus = this._base_value;
        let add_mul = this._base_add_mul;
        let mul_mul = this._base_mul_mul;
        
        if(this._attr_operator_list !== undefined) {
            for(let attr_operator of this._attr_operator_list) {
                switch(attr_operator.op) {
                    case "add":
                        plus += attr_operator.value.value();
                        break;
                    case "add_mul":
                        add_mul += attr_operator.value.value();
                        break;
                    case "mul_mul":
                        mul_mul *= attr_operator.value.value();
                        break;
                    default:
                        assert(false, `AttrOperatorType ${attr_operator.op} 未实现`);
                }
                this.subscribe_dirty_change(attr_operator.value);
            }
        }

        return [plus, add_mul, mul_mul];
    }


    do_refresh_value(source_collection?: AttrSourceCollection) {
        this.disconnect_all_subscriber();
        const r = this.calc_modifier(source_collection);
        if(this._formula) {
            const v = this._formula(source_collection);
            r[0] += v[0];
            r[1] += v[1];
            r[2] *= v[2];
        }

        this._cached_result = r;
        this._final_value = (r[0]) * (1 + r[1]) * r[2];

        if(this._min_attr !== undefined) {
            this._final_value = Math.max(this._final_value, this._min_attr.value());
        }

        if(this._max_attr !== undefined) {
            this._final_value = Math.min(this._final_value, this._max_attr.value());
        }

        this._dirty = false;
    }



    get min_attr(): BaseAttr {
        return this._min_attr;
    }
    set min_attr(attr: BaseAttr) {
        if(this._min_attr) {
            this.unsubscribe_dirty_change(this._min_attr);
        }
        this._min_attr = attr;
        if(attr) {
            this.subscribe_dirty_change(attr);
        }
        this.to_dirty(true);
    }

    get max_attr(): BaseAttr {
        return this._max_attr;
    }
    set max_attr(attr: BaseAttr) {
        if(this._max_attr) {
            this.unsubscribe_dirty_change(this._max_attr);
        }
        this._max_attr = attr;
        if(attr) {
            this.subscribe_dirty_change(attr);
        }
        this.to_dirty(true);
    }

    use_attr_operator_immediately(attr_operator: AttrOperator): void {
        switch(attr_operator.op) {
            case "add":
                this._base_value += attr_operator.value.value();
                break;
            case "add_mul":
                this._base_add_mul += attr_operator.value.value();
                break;
            case "mul_mul":
                this._base_mul_mul *= attr_operator.value.value();
                break;
            case "set":
                this._base_value = attr_operator.value.value();
                break;
            default:
                assert(false, `use_attr_operator_immediately: 属性操作符类型 ${attr_operator.op} 未实现`);
        }
        this.to_dirty(true);
    }

    add_attr_operator(attr_operator: AttrOperator): void {
        if(this._attr_operator_list === undefined) {
            this._attr_operator_list = [];
        }
        this._attr_operator_list.push(attr_operator);
        this.to_dirty(true);
    }

    remove_attr_operator(attr_operator: AttrOperator): void {
        if(this._attr_operator_list === undefined) {
            assert(false, "remove_attr_operator: 当前对象没有属性操作符列表");
            return;
        }
        this._attr_operator_list = this._attr_operator_list.filter(elem => elem !== attr_operator);
        this.to_dirty(true);
    }


}


