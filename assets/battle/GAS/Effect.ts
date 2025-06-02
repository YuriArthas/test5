import { _decorator, assert, Component } from "cc";
import { ASC, ITagName } from "./AbilitySystemComponent";
import { GAS_BaseComponent } from "./AbilitySystemComponent";
import { Attr, AttrOperator, AttrOperatorType, BaseAttr, 属性静态注册器 } from "./属性";
import { FailedReasonContainer, SimpleFailedReason } from "./FailedReason";
import { AbilityInstance } from "./AbilityInstance";
const { ccclass, property } = _decorator;

export type TagModifier_op = "add" | "remove";
export enum TagListEnum {

}

export class AttrModifier {
    aim_name: string;
    attr_operator: AttrOperator;
    test_func: (gas: ASC) => boolean;

    private _attached_attr: Attr;

    constructor(aim_name: string, op: AttrOperatorType, value: BaseAttr, test_func?: (gas: ASC) => boolean) {
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
    durationType: EffectDurationType;
    duration: number;
    asc: ASC;  // Effect总归会绑定一个GAS

    modifier_list: AttrModifier[];
    // tag_modifier_list: TagModifier[];  // 总是更改自身的GAS的tag

    _effect_tags: ITagName[] = undefined;
    _required_tags: ITagName[] = undefined;
    _blocked_tags: ITagName[] = undefined;
    _remove_other_tags: ITagName[] = undefined;
    _block_other_tags: ITagName[] = undefined;
    _attached: boolean = false;

    constructor(asc: ASC, effect_tags: ITagName[], durationType: EffectDurationType, duration: number, modifier_list?: AttrModifier[]) {
        this.asc = asc;
        this._effect_tags = effect_tags;
        this.durationType = durationType;
        this.duration = duration;
        if(modifier_list) {
            this.modifier_list = modifier_list;
        }
    }

    set effectTags(tags: ITagName[]) {
        this._effect_tags = tags;
    }

    // 当前effect的tag
    get effectTags(): Readonly<ITagName[]> {
        return this._effect_tags;
    }

    set requiredTags(tags: ITagName[]) {
        this._required_tags = tags;
    }

    // 如果目标身上没有这些 Tag，GE 将不会应用
    get requiredTags(): Readonly<ITagName[]> {
        return this._required_tags?? EmptyTagList;
    }

    set grantTags(tags: ITagName[]) {
        this._effect_tags = tags;
    }

    // 应用当前 GE 时，自动添加这些 Tag
    get grantTags(): Readonly<ITagName[]> {
        return this._effect_tags?? EmptyTagList;
    }

    set blockedTags(tags: ITagName[]) {
        this._blocked_tags = tags;
    }

    // 如果目标拥有这些 Tag，GE 将不会应用
    get blockedTags(): Readonly<ITagName[]> {
        return this._blocked_tags?? EmptyTagList;
    }

    set removeOtherTags(tags: ITagName[]) {
        this._remove_other_tags = tags;
    }

    // 应用当前 GE 时，自动移除目标身上具有这些 Tag 的 GE
    get removeOtherTags(): Readonly<ITagName[]> {
        return this._remove_other_tags?? EmptyTagList;
    }

    set blockOtherTags(tags: ITagName[]) {
        this._block_other_tags = tags;
    }

    // 使目标免疫具有这些 Tag 的 GE 应用
    get blockOtherTags(): Readonly<ITagName[]> {
        return this._block_other_tags?? EmptyTagList;
    }

    TestAttach(reason?: FailedReasonContainer): boolean {
        if(this.requiredTags.length > 0) {
            for(let tag of this.requiredTags) {
                let found = false;
                if(this.asc.owned_tags.has(tag)) {
                    found = true;
                    break;
                }
                
                if(!found) {
                    if (reason) {
                        reason.value = new SimpleFailedReason("Required tag not found: " + tag.toString());
                    }
                    return false;
                }
            }
        }

        if(this.blockedTags.length > 0) {
            for(let tag of this.blockedTags) {
                let found = false;
                if(this.asc.owned_tags.has(tag)) {
                    found = true;
                    break;
                }
                
                if(found) {
                    reason.value = new SimpleFailedReason("Blocked tag found: " + tag.toString());
                    return false;
                }
            }
        }

        if(this.modifier_list) {
            for(let modifier of this.modifier_list) {
                let attr = this.asc.属性Map.get(modifier.aim_name);
                if(!attr) {
                    if (reason) {
                        reason.value = new SimpleFailedReason("Attribute not found: " + modifier.aim_name);
                    }
                    return false;
                }

                if(modifier.test_func){
                    if(!modifier.test_func(this.asc)) {
                        if (reason) {
                            reason.value = new SimpleFailedReason("Test func failed: " + modifier.aim_name);
                        }
                        return false;
                    }
                }
            }
        }

        return true;
    }

    get attached(): boolean {
        return this._attached;
    }

    attach(): void {
        assert(!this._attached, "attach: Effect已经attached");
        if(this.durationType != "immediately") {
            for(let tag of this.effectTags){
                let effect_list = this.asc.tag_effect_map.get(tag);
                if(effect_list) {
                    effect_list.push(this);
                } else {
                    this.asc.tag_effect_map.set(tag, [this]);
                }
            }

            for(let modifier of this.modifier_list) {
                const attr = this.asc.属性Map.get(modifier.aim_name);
                assert(attr !== undefined, `attach: 属性 ${modifier.aim_name} 不存在`);
                assert(attr instanceof Attr, `attach: 属性 ${modifier.aim_name} 不是 Attr`);
                modifier.attached_attr = attr;
                attr.add_attr_operator(modifier.attr_operator);
            }
        }else{
            for(let modifier of this.modifier_list) {
                const attr = this.asc.属性Map.get(modifier.aim_name);
                assert(attr !== undefined, `attach: 属性 ${modifier.aim_name} 不存在`);
                assert(attr instanceof Attr, `attach: 属性 ${modifier.aim_name} 不是 Attr`);
                modifier.attached_attr = attr;
                modifier.attached_attr.use_attr_operator_immediately(modifier.attr_operator);
            }
        }

        for(let tag of this.grantTags) {
            let count = this.asc.owned_tags.get(tag);
            if(count !== undefined) {
                this.asc.owned_tags.set(tag, count + 1);
            } else {
                this.asc.owned_tags.set(tag, 1);
            }
        }

        for(let tag of this.blockOtherTags) {
            let count = this.asc.blocked_other_tags.get(tag);
            if(count !== undefined) {
                this.asc.blocked_other_tags.set(tag, count + 1);
            } else {
                this.asc.blocked_other_tags.set(tag, 1);
            }
        }

        const to_remove_effects: Set<Effect> = new Set();
        for(let tag of this.removeOtherTags) {
            const effect_list =this.asc.tag_effect_map.get(tag);
            if(effect_list) {
                for(let effect of effect_list) {
                    to_remove_effects.add(effect);
                }
            }
        }

        for(let elem of to_remove_effects) {
            elem.detach();
        }

        const to_remove_abilitys: Set<AbilityInstance> = new Set();
        for(let tag of this.removeOtherTags) {
            const ability_list = this.asc.tag_ability_map.get(tag);
            if(ability_list) {
                for(let ability of ability_list) {
                    to_remove_abilitys.add(ability);
                }
            }
        }
        for(let ability of to_remove_abilitys) {
            ability.cancel_ability();
        }

        this._attached = true;
        this.on_attach();
    }

    on_attach(): void {

    }

    detach(): void {
        assert(this._attached, "detach: Effect未attached");
        assert(this.durationType != "immediately", "detach: 立即生效的Effect不能被detach");
        for(let tag of this.effectTags) {
            let effect_list = this.asc.tag_effect_map.get(tag);
            if(effect_list) {
                effect_list.splice(effect_list.indexOf(this), 1);
                if(effect_list.length === 0) {
                    this.asc.tag_effect_map.delete(tag);
                }
            }
        }
        for(let modifier of this.modifier_list) {
            modifier.attached_attr.remove_attr_operator(modifier.attr_operator);
        }

        this._attached = false;
        this.on_detach();
    }

    on_detach(): void {
        
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