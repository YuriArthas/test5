import { assert } from "cc";
import { ASC as ASC } from "./AbilitySystemComponent";
import { Pawn, Player, Team } from "./Unit";


export class AttrOperator {
    value: BaseAttribute;
    op: AttrOperatorType;

    constructor(op: AttrOperatorType, value: BaseAttribute) {
        this.value = value;
        this.op = op;
    }
}


export type AttrOperatorType = "add" | "add_mul" | "set" | "mul_mul" ;

export type type属性构造函数 = new (asc: ASC, name: string, base_value?: number) => Attribute;
export type type属性创建Factory = {
    attr_class?: type属性构造函数;
    base_value?: number;
    formula?: AttrFormula;

    pawn_max_attr_name?: string;
    pawn_min_attr_name?: string;
}

export class 属性静态注册器 {
    default_attr_formula_builder: (attr_name: string) => AttrFormula = undefined;

    注册(name: string, factory: type属性创建Factory) {
        if(属性静态注册器.属性构造Map.has(name)) {
            throw new Error(`属性 ${name} 已存在`);
        }
        属性静态注册器.属性构造Map.set(name, factory);
    }

    获取(name: string): type属性创建Factory {
        if(属性静态注册器.属性构造Map.has(name)) {
            return 属性静态注册器.属性构造Map.get(name);
        }
        throw new Error(`属性 ${name} 不存在`);
    }

    创建(name: string, asc: ASC, base_value: number = undefined): Attribute {
        let 工厂 = this.获取(name);
        if(工厂 === undefined) {
            工厂 = {
                attr_class: Attribute,
                base_value: 0,
            };
        }

        if(base_value === undefined) {
            base_value = 工厂.base_value;
            if(base_value === undefined) {
                base_value = 0;
            }
        }

        
        let formula = 工厂.formula;
        if(!formula && this.default_attr_formula_builder){
            formula = this.default_attr_formula_builder(name);
        }

        const attr = new 工厂.attr_class(asc, name, base_value);
        if(formula){
            attr.set_formula(formula);
        }

        if(attr.asc.unit instanceof Pawn){
            if(工厂.pawn_max_attr_name){
                const max_attr = attr.asc.get_attribute(工厂.pawn_max_attr_name);
                attr.max_attr = max_attr;
            }
            if(工厂.pawn_min_attr_name){
                const min_attr = attr.asc.get_attribute(工厂.pawn_min_attr_name);
                attr.min_attr = min_attr;
            }
        }

        return attr;
    }

    static 属性构造Map: Map<string, type属性创建Factory> = new Map();
    
}

// 这个类以后有用
export class AttrSourceCollection {

}


export type AttrFomulaResult = [number, number, number];

export type AttrFormula = (attr: Attribute, source_collection?: AttrSourceCollection) => Readonly<AttrFomulaResult>;

export class BaseAttribute{
    protected _dirty_publisher_array?: BaseAttribute[];
    protected _dirty_subscriber_array?: BaseAttribute[];
    protected dirty_event_list: ((attr: BaseAttribute, old_value: number) => void)[];

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

    protected static _dirty_and_collect(list: [BaseAttribute, number][], attr: BaseAttribute){
        attr._dirty = true;
        list.push([attr, attr.cached_value()]);

        if(attr._dirty_subscriber_array) {
            for(let elem of attr._dirty_subscriber_array) {
                if(elem._dirty == false) {
                    Attribute._dirty_and_collect(list, elem);
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

        const dirty_list: [BaseAttribute, number][] = [];
        Attribute._dirty_and_collect(dirty_list, this);

        this.disconnect_all_subscriber();

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

    subscribe_dirty_change(obj: BaseAttribute): void {
        if(this._dirty_subscriber_array === undefined) {
            this._dirty_subscriber_array = [];
        }
        this._dirty_subscriber_array.push(obj);

        if(obj._dirty_publisher_array === undefined){
            obj._dirty_publisher_array = [];
        }
        obj._dirty_publisher_array.push(this);
    }

    unsubscribe_dirty_change(obj: BaseAttribute): void {
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

export class Attribute extends BaseAttribute{
    asc: ASC = undefined;
    protected _attr_operator_list?: AttrOperator[];

    name: string = undefined;
    protected _base_add_mul: number = 0;
    protected _base_mul_mul: number = 1;
    protected _cached_result: Readonly<AttrFomulaResult> = undefined;
    protected _final_value: number = undefined;
    protected _formula: AttrFormula = undefined;
    protected _min_attr: BaseAttribute;
    protected _max_attr: BaseAttribute;


    constructor(asc: ASC, name: string, base_value?: number) {
        super(base_value);
        this.name = name;
        this.asc = asc;
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

    calc_inherit(source_collection?: AttrSourceCollection): AttrFomulaResult {
    
        const ret: AttrFomulaResult = [0, 0, 1];
        const unit = this.asc.unit;
        if(unit instanceof Pawn){
            if(unit.player){
                const player_attr = unit.player.asc.get_attribute(this.name);
                if(player_attr instanceof Attribute){
                    const r = player_attr.cached_result();
                    ret[0] += r[0];
                    ret[1] += r[1];
                    ret[2] *= r[2];
                }else{
                    ret[0] += player_attr.value();
                }
                this.subscribe_dirty_change(player_attr);
            }
        }else if(unit instanceof Player){
            if(unit.team){
                const team_attr = unit.team.asc.get_attribute(this.name);
                if(team_attr instanceof Attribute){
                    const r = team_attr.cached_result();
                    ret[0] += r[0];
                    ret[1] += r[1];
                    ret[2] *= r[2];
                }else{
                    ret[0] += team_attr.value();
                }
                this.subscribe_dirty_change(team_attr);
            }
        }else if(unit instanceof Team){
            if(unit.asc.world){
                const world_attr = unit.asc.world.asc.get_attribute(this.name);
                if(world_attr instanceof Attribute){
                    const r = world_attr.cached_result();
                    ret[0] += r[0];
                    ret[1] += r[1];
                    ret[2] *= r[2];
                }else{
                    ret[0] += world_attr.value();
                }
                this.subscribe_dirty_change(world_attr);
            }
        }
        
        return ret;
    }

    formula(): AttrFormula {
        return this._formula;
    }

    set_formula(formula: AttrFormula): void {
        this._formula = formula;
        this.to_dirty(true);
    }

    set base_add_mul(value: number) {
        this._base_add_mul += value;
        this.to_dirty(true);
    }

    get base_add_mul(): number {
        return this._base_add_mul;
    }

    set base_mul_mul(value: number) {
        this._base_mul_mul = value;
        this.to_dirty(true);
    }

    get base_mul_mul(): number {
        return this._base_mul_mul;
    }

    static calc_final_value(value: number, cached_result: Readonly<AttrFomulaResult>): number {
        return (value + cached_result[0]) * (1 + cached_result[1]) * cached_result[2];
    }

    do_refresh_value(source_collection?: AttrSourceCollection) {
        this.disconnect_all_subscriber();
        const r = this.calc_modifier(source_collection);
        const r2 = this.calc_inherit(source_collection);
        r[0] += r2[0];
        r[1] += r2[1];
        r[2] *= r2[2];

        if(this._formula) {
            const v = this._formula(this, source_collection);
            r[0] += v[0];
            r[1] += v[1];
            r[2] *= v[2];
        }

        this._cached_result = r;
        this._final_value = (r[0]) * (1 + r[1]) * r[2];

        if(this._max_attr !== undefined) {
            this.subscribe_dirty_change(this._max_attr);
            this._final_value = Math.min(this._final_value, this._max_attr.value());
        }

        if(this._min_attr !== undefined) {
            this.subscribe_dirty_change(this._min_attr);
            this._final_value = Math.max(this._final_value, this._min_attr.value());
        }

        this._dirty = false;
    }

    get min_attr(): BaseAttribute {
        return this._min_attr;
    }
    set min_attr(attr: BaseAttribute) {
        this._min_attr = attr;
        this.to_dirty(true);
    }

    get max_attr(): BaseAttribute {
        return this._max_attr;
    }
    set max_attr(attr: BaseAttribute) {
        this._max_attr = attr;
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


