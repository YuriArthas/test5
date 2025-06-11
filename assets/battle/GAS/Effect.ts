import { _decorator, assert } from "cc";
import { ASC, ITagName } from "./AbilitySystemComponent";
import { Attribute, AttrOperator, AttrOperatorType, BaseAttribute, 属性预定义器 } from "./属性";
import { FailedReasonContainer, SimpleFailedReason } from "./FailedReason";
import { AbilityInstance } from "./AbilityInstance";
const { ccclass, property } = _decorator;

export type TagModifier_op = "add" | "remove";
export enum TagListEnum {

}

export class AttrModifier {
    aim_name: string = undefined;
    attr_operator: AttrOperator = undefined;
    private _attached_attr: Attribute = undefined;
    test_func: (asc: ASC) => boolean;

    constructor(aim_name: string, op: AttrOperatorType, value: BaseAttribute, test_func?: (gas: ASC) => boolean) {
        this.aim_name = aim_name;
        this.attr_operator = new AttrOperator(op, value);
        if(test_func) {
            this.test_func = test_func;
        }
    }

    get attached_attr(): Attribute {
        return this._attached_attr;
    }

    set attached_attr(attr: Attribute) {
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

export interface EffectInitData {
    asc: ASC;
    effect_tags: ITagName[];
    durationType: EffectDurationType;
    duration?: number;
    modifier_list?: AttrModifier[];
    required_tags?: ITagName[];
    blocked_tags?: ITagName[];
    remove_other_tags?: ITagName[];
    block_other_tags?: ITagName[];
    on_attach?: () => void;
    on_detach?: () => void;
}

export class Effect {
    durationType: EffectDurationType = undefined;
    duration: number;
    asc: ASC = undefined;  // Effect总归会绑定一个GAS

    modifier_list: AttrModifier[];
    // tag_modifier_list: TagModifier[];  // 总是更改自身的GAS的tag

    _effect_tags: ITagName[] = undefined;
    _required_tags: ITagName[];
    _blocked_tags: ITagName[];
    _remove_other_tags: ITagName[];
    _block_other_tags: ITagName[];
    _has_attached: boolean = false;

    init(init_data: EffectInitData){
        this.asc = init_data.asc;
        this._effect_tags = init_data.effect_tags;
        this.durationType = init_data.durationType;
        this.duration = init_data.duration?? 0;
        if(init_data.modifier_list) {
            this.modifier_list = init_data.modifier_list;
        }
        if(init_data.required_tags) {
            this._required_tags = init_data.required_tags;
        }
        if(init_data.blocked_tags) {
            this._blocked_tags = init_data.blocked_tags;
        }
        if(init_data.remove_other_tags) {
            this._remove_other_tags = init_data.remove_other_tags;
        }
        if(init_data.block_other_tags) {
            this._block_other_tags = init_data.block_other_tags;
        }
        if(init_data.on_attach) {
            this.on_attach = init_data.on_attach;
        }
        if(init_data.on_detach) {
            this.on_detach = init_data.on_detach;
        }
    }

    // 当前effect的tag
    get effectTags(): Readonly<ITagName[]> {
        return this._effect_tags;
    }

    // 如果目标身上没有这些 Tag，GE 将不会应用
    get requiredTags(): Readonly<ITagName[]> {
        return this._required_tags?? EmptyTagList;
    }

    // 应用当前 GE 时，自动添加这些 Tag
    get grantTags(): Readonly<ITagName[]> {
        return this._effect_tags?? EmptyTagList;
    }

    // 如果目标拥有这些 Tag，GE 将不会应用
    get blockedTags(): Readonly<ITagName[]> {
        return this._blocked_tags?? EmptyTagList;
    }

    // 应用当前 GE 时，自动移除目标身上具有这些 Tag 的 GE
    get removeOtherTags(): Readonly<ITagName[]> {
        return this._remove_other_tags?? EmptyTagList;
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

    get has_attached(): boolean {
        return this._has_attached;
    }

    attach(): void {
        assert(!this._has_attached, "attach: Effect已经attached");
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
                assert(attr instanceof Attribute, `attach: 属性 ${modifier.aim_name} 不是 Attr`);
                modifier.attached_attr = attr;
                attr.add_attr_operator(modifier.attr_operator);
            }
        }else{
            for(let modifier of this.modifier_list) {
                const attr = this.asc.属性Map.get(modifier.aim_name);
                assert(attr !== undefined, `attach: 属性 ${modifier.aim_name} 不存在`);
                assert(attr instanceof Attribute, `attach: 属性 ${modifier.aim_name} 不是 Attr`);
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

        this._has_attached = true;
        this.on_attach();
    }

    on_attach(): void {

    }

    detach(): void {
        assert(this._has_attached, "detach: Effect未attached");
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

        this._has_attached = false;
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