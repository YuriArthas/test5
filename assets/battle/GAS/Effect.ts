import { _decorator, assert, Component } from "cc";
import { GAS, ITagName } from "./AbilitySystemComponent";
import { GAS_BaseComponent } from "./AbilitySystemComponent";
import { Attr, AttrOperator, AttrOperatorType, 属性静态注册器 } from "./属性";
const { ccclass, property } = _decorator;

export type TagModifier_op = "add" | "remove";
export enum TagListEnum {

}

export class AttrModifier {
    aim_name: string;
    attr_operator: AttrOperator;
    test_func: (gas: GAS) => boolean;

    private _attached_attr: Attr;

    constructor(aim_name: string, op: AttrOperatorType, value: Attr, test_func?: (gas: GAS) => boolean) {
        this.aim_name = aim_name;
        this.attr_operator = new AttrOperator(op, value);
        if(test_func) {
            this.test_func = test_func;
        }
    }

    get attached_attr(): Attr {
        return this._attached_attr;
    }

    set attached_attr(attr: Attr) {
        this._attached_attr = attr;
    }
}



// export class TagModifier {
//     tag: ITagName;
//     op: TagModifier_op;

//     constructor(tag: ITagName, op: TagModifier_op, value: number) {
//         this.tag = tag;
//         this.op = op;
//         this.value = value;
//     }
// }

export type EffectDurationType = "immediately" | "duration" | "manual" | "infinite";
export const EmptyTagList: Readonly<ITagName[]> = [];

export class GAS_Effect {
    durationType: EffectDurationType;
    duration: number;
    
    gas: GAS;  // Effect总归会绑定一个GAS

    modifier_list: AttrModifier[];
    // tag_modifier_list: TagModifier[];  // 总是更改自身的GAS的tag

    constructor(gas: GAS, durationType: EffectDurationType, duration: number, modifier_list?: AttrModifier[]) {
        this.gas = gas;
        this.durationType = durationType;
        this.duration = duration;
        if(modifier_list) {
            this.modifier_list = modifier_list;
        }
    }

    // 当前effect的tag
    get effectTags(): Readonly<ITagName[]> {
        throw new Error("effectTags: 子类必须实现");
    }

    // 如果目标身上没有这些 Tag，GE 将不会应用
    get requiredTags(): Readonly<ITagName[]> {
        return EmptyTagList;
    }

    // 应用当前 GE 时，自动添加这些 Tag
    get grantTags(): Readonly<ITagName[]> {
        return EmptyTagList;
    }

    // 如果目标拥有这些 Tag，GE 将不会应用
    get blockedTags(): Readonly<ITagName[]> {
        return EmptyTagList;
    }

    // 应用当前 GE 时，自动移除目标身上具有这些 Tag 的 GE
    get removeEffectTags(): Readonly<ITagName[]> {
        return EmptyTagList;
    }

    // 使目标免疫具有这些 Tag 的 GE 应用
    get GrantImmunityTags(): Readonly<ITagName[]> {
        return EmptyTagList;
    }

    TestAttach(): boolean {
        if(this.requiredTags.length > 0) {
            for(let tag of this.requiredTags) {
                let found = false;
                for(let [key] of this.gas.owned_tags) {
                    if(key.contains(tag)) {
                        found = true;
                        break;
                    }
                }
                if(!found) {
                    return false;
                }
            }
        }

        if(this.blockedTags.length > 0) {
            for(let tag of this.blockedTags) {
                let found = false;
                for(let [key] of this.gas.owned_tags) {
                    if(key.contains(tag)) {
                        found = true;
                        break;
                    }
                }
                if(found) {
                    return false;
                }
            }
        }

        if(this.modifier_list) {
            for(let modifier of this.modifier_list) {
                let attr = this.gas.属性Map.get(modifier.aim_name);
                if(!attr) {
                    attr = 属性静态注册器.创建(modifier.aim_name, this.gas);
                }

                if(modifier.test_func){
                    if(!modifier.test_func(this.gas)) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    attach(): void {
        if(this.durationType != "immediately") {
            this.gas.effects.push(this);
        }

        for(let modifier of this.modifier_list) {
            modifier.attached_attr = this.gas.属性Map.get(modifier.aim_name);
            assert(modifier.attached_attr !== undefined, `attach: 属性 ${modifier.aim_name} 不存在`);
            modifier.attached_attr.add_attr_operator(modifier.attr_operator);
        }

        for(let tag of this.grantTags) {
            let count = this.gas.owned_tags.get(tag);
            if(count !== undefined) {
                this.gas.owned_tags.set(tag, count + 1);
            } else {
                this.gas.owned_tags.set(tag, 1);
            }
        }

        const to_remove_effects: GAS_Effect[] = [];
        for(let tag of this.removeEffectTags) {
            this.gas.effects = this.gas.effects.filter(elem => {
                for(let key of elem.effectTags) {
                    if(key.contains(tag)) {
                        to_remove_effects.push(elem);
                        return false;
                    }
                }
                return true;
            });
        }

        for(let elem of to_remove_effects) {
            elem.detach();
        }
    }

    detach(): void {
        assert(this.durationType != "immediately", "detach: 立即生效的Effect不能被detach");
        this.gas.effects = this.gas.effects.filter(elem => elem !== this);
        for(let modifier of this.modifier_list) {
            modifier.attached_attr.remove_attr_operator(modifier.attr_operator);
        }
    }

    duration_update(delta: number): void {
        if(this.durationType === "duration" || this.durationType === "manual") {
            this.duration -= delta;
            if(this.duration <= 0) {
                this.detach();
            }
        }
    }
    
}