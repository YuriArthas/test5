import { _decorator, assert, Component } from "cc";
import { ASC, ITagName } from "./AbilitySystemComponent";
import { Attr, AttrOperator, AttrOperatorType, 属性静态注册器 } from "./属性";
const { ccclass, property } = _decorator;

export type TagModifier_op = "add" | "remove";
export enum TagListEnum {

}

export class AttrModifier {
    aim_name: string = undefined;
    attr_operator: AttrOperator = undefined;
    test_func: (gas: ASC) => boolean = undefined;

    private _attached_attr: Attr;

    constructor(aim_name: string, op: AttrOperatorType, value: Attr, test_func?: (gas: ASC) => boolean) {
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

export class Effect {
    durationType: EffectDurationType = undefined;
    duration: number = undefined;

    readonly _effect_tags: Readonly<ITagName[]> = undefined;
    
    asc: ASC = undefined;  // Effect总归会绑定一个GAS

    modifier_list: AttrModifier[] = undefined;
    // tag_modifier_list: TagModifier[];  // 总是更改自身的GAS的tag

    constructor(asc: ASC, effect_tags: Readonly<ITagName[]>, durationType: EffectDurationType, duration: number, modifier_list?: AttrModifier[]) {
        this.asc = asc;
        this.durationType = durationType;
        this.duration = duration;
        this._effect_tags = effect_tags;
        
        this.modifier_list = modifier_list;
        
    }

    // 当前effect的tag
    effectTags(): Readonly<ITagName[]> {
        return this._effect_tags;
    }

    // 如果目标身上没有这些 Tag，GE 将不会应用
    attach_required_tags(): Readonly<ITagName[]> {
        return undefined;
    }

    // 应用当前 GE 时，自动添加这些 Tag
    grant_tags(): Readonly<ITagName[]> {
        return undefined;
    }

    // 如果目标拥有这些 Tag，GE 将不会应用
    block_me_attach_tags(): Readonly<ITagName[]> {
        return undefined;
    }

    // 应用当前 GE 时，自动移除目标身上具有这些 Tag 的 GE/Ability
    cancel_other_tags(): Readonly<ITagName[]> {
        return undefined;
    }

    // 使目标免疫具有这些 Tag 的 GE 应用
    block_other_tags(): Readonly<ITagName[]> {
        return undefined;
    }

    TestAttach(): boolean {
        const required_tags = this.attach_required_tags();
        if(required_tags) {
            for(let tag of required_tags) {
                let found = false;
                for(let [key] of this.asc.owned_tags) {
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

        const blocked_tags = this.block_me_attach_tags();
        if(blocked_tags) {
            for(let tag of blocked_tags) {
                let found = false;
                for(let [key] of this.asc.owned_tags) {
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
                let attr = this.asc.属性Map.get(modifier.aim_name);
                if(!attr) {
                    attr = 属性静态注册器.创建(modifier.aim_name, this.asc);
                }

                if(modifier.test_func){
                    if(!modifier.test_func(this.asc)) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    attach(): void {
        if(this.durationType != "immediately") {
            this.asc.effects.push(this);
        }

        for(let modifier of this.modifier_list) {
            modifier.attached_attr = this.asc.属性Map.get(modifier.aim_name);
            assert(modifier.attached_attr !== undefined, `attach: 属性 ${modifier.aim_name} 不存在`);
            modifier.attached_attr.add_attr_operator(modifier.attr_operator);
        }

        const grant_tags = this.grant_tags();
        if(grant_tags) {
            for(let tag of grant_tags) {
                let count = this.asc.owned_tags.get(tag);
                if(count !== undefined) {
                    this.asc.owned_tags.set(tag, count + 1);
                } else {
                    this.asc.owned_tags.set(tag, 1);
                }
            }
        }

        const cancel_other_tags = this.cancel_other_tags();
        if(cancel_other_tags) {
            this.asc.cancel_by_tags(cancel_other_tags);
        }
    }

    detach(): void {
        assert(this.durationType != "immediately", "detach: 立即生效的Effect不能被detach");
        this.asc.effects = this.asc.effects.filter(elem => elem !== this);
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