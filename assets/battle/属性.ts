import { assert } from "cc";
import { I属性管理器 } from "./I属性管理器";




export class 属性Modifier {
    readonly 类型: "add" | "mul";
    值: number;
    source: any;
    
    constructor(类型: "add" | "mul", 值: number, source: any = undefined) {
        this.类型 = 类型;
        this.值 = 值;
        this.source = source;
    }
}

type type属性构造函数 = new (管理器: I属性管理器, base_value: number) => 属性;
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

    static 创建(name: string, 管理器: I属性管理器, base_value: number = undefined): 属性 {
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

        const 属性 = new 工厂.constructor_func(管理器, base_value);
        if(工厂.max_attr_name){
            属性.max_attr_name = 工厂.max_attr_name;
        }
        if(工厂.min_attr_name){
            属性.min_attr_name = 工厂.min_attr_name;
        }
        return 属性;
    }

    static 属性构造Map: Map<string, type属性创建Factory> = new Map();
}

export class 属性 {
    readonly 管理器: I属性管理器;
    constructor(管理器: I属性管理器, base_value: number) {
        this.管理器 = 管理器;
        this._base_value = base_value;
        this._value = base_value;
    }

    private _dirty: boolean = true;
    get dirty(): boolean {
        return this._dirty;
    }
    to_dirty(trigger_dirty_event: boolean = true, recursive_dirty: boolean = true) {
        if(this._dirty == false) {
            this._dirty = true;
            if(recursive_dirty) {
                for(let elem of this.依赖我的Set) {
                    elem.to_dirty(false, false);
                }
            }
    
            if(trigger_dirty_event) {
                if(recursive_dirty) {
                    for(let elem of this.依赖我的Set) {
                        if(elem.dirty_event_list){
                            for(let event of elem.dirty_event_list){
                                event(elem, this._value);
                            }
                        }
                    }
                }
    
                if(this.dirty_event_list){
                    for(let event of this.dirty_event_list){
                        event(this, this._value);
                    }
                }
            }
        }
    }

    private _value: number = 0;
    get value(): number {
        if(this._dirty) {
            const ref_stack: 属性[] = [];
            this.do_recalculate(ref_stack);
        }
        return this._value;
    }

    do_recalculate(ref_stack: 属性[]) {
        assert(this._dirty, "属性未脏");
        const len = ref_stack.length;
        if(ref_stack){
            if(ref_stack.indexOf(this) !== -1) {
                throw new Error("属性循环依赖");
            }
            ref_stack.push(this);
        }
        let value = this.recalculate(ref_stack);

        if(this._min_attr_name){
            const min_attr = this.管理器.get_attr(this._min_attr_name, false);
            if(min_attr){
                for(const elem of ref_stack){
                    min_attr.add_reffed_me(elem);
                }
                if(min_attr.dirty){
                    min_attr.do_recalculate(ref_stack);
                }
                if(value < min_attr.value){
                    value = min_attr.value;
                }
            }
        }

        if(this._max_attr_name){
            const max_attr = this.管理器.get_attr(this._max_attr_name, false);
            if(max_attr){
                for(const elem of ref_stack){
                    max_attr.add_reffed_me(elem);
                }
                if(max_attr.dirty){
                    max_attr.do_recalculate(ref_stack);
                }
                if(value > max_attr.value){
                    value = max_attr.value;
                }
            }
        }

        ref_stack.length = len;
        this._value = value;
        this._dirty = false;
    }

    private _base_value: number = 0;
    get base_value(): number {
        return this._base_value;
    }

    set base_value(v: number) {
        this.to_dirty(true, true);
        this._base_value = v;
    }

    private _modifier_add_list: 属性Modifier[] = undefined;
    private _modifier_mul_list: 属性Modifier[] = undefined;
    add_modifier(类型: "add" | "mul", 值: number, source: any = undefined) {
        if(this._modifier_add_list === undefined) {
            this._modifier_add_list = [];
        }
        this._modifier_add_list.push(new 属性Modifier(类型, 值, source));
        this.to_dirty(true, true);
    }
    remove_modifier(modifier: 属性Modifier) {
        if(modifier.类型 === "add"){
            if(this._modifier_add_list === undefined) {
                return;
            }
            this._modifier_add_list = this._modifier_add_list.filter(modifier => modifier.source !== modifier.source);
        }else{
            if(this._modifier_mul_list === undefined) {
                return;
            }
            this._modifier_mul_list = this._modifier_mul_list.filter(modifier => modifier.source !== modifier.source);
        }

        this.to_dirty(true, true);
    }

    // private 我依赖的Set: Set<属性> = undefined;
    private 依赖我的Set: Set<属性> = undefined;
    private dirty_event_list: Set<(attr: 属性, old_value: number) => void> = undefined;

    private _min_attr_name: string = undefined;
    get min_attr_name(): string {
        return this._min_attr_name;
    }
    set min_attr_name(v: string) {
        this._min_attr_name = v;
        this.to_dirty(true, true);
    }

    private _max_attr_name: string = undefined;
    get max_attr_name(): string {
        return this._max_attr_name;
    }
    set max_attr_name(v: string) {
        this._max_attr_name = v;
        this.to_dirty(true, true);
    }

    on_dirty(f: (attr: 属性, old_value: number) => void) {
        if(this.dirty_event_list === undefined) {
            this.dirty_event_list = new Set();
        }
        this.dirty_event_list.add(f);
    }

    off_dirty(f: (attr: 属性, old_value: number) => void) {
        if(this.dirty_event_list === undefined) {
            return;
        }
        this.dirty_event_list.delete(f);
    }

    add_reffed_me(attr: 属性) {
        if(this.依赖我的Set === undefined) {
            this.依赖我的Set = new Set();
        }
        this.依赖我的Set.add(attr);
    }

    get_or_create_dep_attr(name: string, ref_stack?: 属性[]): 属性 {
        let attr = this.管理器.get_attr(name, true);

        if(ref_stack){
            for(let elem of ref_stack) {
                attr.add_reffed_me(elem);
            }
        }
        return attr;
    }

    calc_self(){
        let ret = this.base_value;
        
        if(this._modifier_add_list !== undefined) {
            for(let modifier of this._modifier_add_list) {
                ret += modifier.值;
            }
        }

        if(this._modifier_mul_list !== undefined) {
            for(let modifier of this._modifier_mul_list) {
                ret *= modifier.值;
            }
        }

        return ret;
    }

    private recalculate(ref_stack?: 属性[]): number {
        return this.calc_self();
    }
}
