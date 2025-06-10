import { AbilityInstance } from "./AbilityInstance";
import { ASC, ITagName } from "./AbilitySystemComponent";
import { Effect } from "./Effect";
import { FailedReason, FailedReasonContainer, SimpleFailedReason } from "./FailedReason";
import { create_and_init, Unit, World } from "./Unit";
import { Vec2 } from "cc";
import { AttrFormula, Attribute, BaseAttribute, IAttributeHost, IAttributeManager } from "./属性";

type Point = Vec2;

export class AbilityTarget {
    target: Unit|Point|undefined = undefined;
}

export enum AbilityTargetType {
    NONE = 0,
    Unit = 1,
    Point = 2,
    NO_TARGET = 4,
}

export interface AbilitySpecInitData {
    owner: Unit;
    attribute_manager?: AbilitySpecAttributeManager;
}

export class AbilitySpecAttributeManager implements IAttributeManager {

    get_attribute<T extends BaseAttribute>(name: string, create_if_not_exist?: boolean): T {
        return this..get_attribute(name, create_if_not_exist);  // 这里需要实现
    }

    world: World = undefined;
    attached_host: IAttributeHost = undefined;
    属性Map: Map<string, BaseAttribute> = new Map();
    default_attr_formula?: AttrFormula = undefined;
}

export class AbilitySpec implements IAttributeHost {
    attribute_manager: AbilitySpecAttributeManager = undefined;
    owner: Unit = undefined;
    running_ability_instance_list: AbilityInstance[] = [];

    init(init_data: AbilitySpecInitData) {
        if(init_data.attribute_manager) {
            this.attribute_manager = init_data.attribute_manager;
        } else {
            this.attribute_manager = new AbilitySpecAttributeManager();
            this.attribute_manager.world = init_data.owner.asc.world;
            this.attribute_manager.attached_host = this;
        }
        
        this.owner = init_data.owner;
    }

    cast_range(): number {
        const attr = this.attribute_manager.get_attribute<Attribute>("施法距离");
        const cached_result = attr.cached_result();
        return Attribute.calc_final_value(attr.base_value, cached_result);
    }

    get attribute_manager_inherit(): IAttributeHost {
        return this.owner;
    }

    target_type(): number {
        return AbilityTargetType.NONE;
    }

    cast(target: AbilityTarget, reason?: FailedReasonContainer): boolean{
        let to_check_effects = this.get_to_check_effects();
        if(!this.can_cast(target, to_check_effects, reason)) {
            return false;
        }

        const ability_instance_class = this.ability_instance_class();
        let ability_instance = create_and_init(ability_instance_class, {
            world: this.owner.asc.world,
            caster: this.owner,
            target: target,
            ability_spec: this,
            to_check_effects: to_check_effects,
        });

        ability_instance._active();

        return true;
    }

    // return [can_cast, failed_effect]
    can_cast(target: AbilityTarget, to_check_effects?: Effect[], reason?: FailedReasonContainer): boolean{
        const target_type = this.target_type();
        if(target_type & AbilityTargetType.NO_TARGET) {
            if(target.target != undefined){
                if (reason) {
                    reason.value = new SimpleFailedReason("Target is not none");
                }
                return false;
            }
        }

        if(target_type & AbilityTargetType.Unit) {
            if(target.target == undefined){
                if (reason) {
                    reason.value = new SimpleFailedReason("Target is not unit");
                }
                return false;
            }
        }

        if(target_type & AbilityTargetType.Point) {
            if(target.target instanceof Vec2){
                if (reason) {
                    reason.value = new SimpleFailedReason("Target is not point");
                }
                return false;
            }
        }
        const required_tags = this.required_tags();
        if(required_tags) {
            for(let tag of required_tags) {
                if(!this.owner.asc.owned_tags.has(tag)) {
                    if (reason) {
                        reason.value = new SimpleFailedReason("Required tag not found: " + tag);
                    }
                    return false;
                }
            }
        }

        const blocked_tags = this.blocked_tags();
        if(blocked_tags) {
            for(let tag of blocked_tags) {
                if(this.owner.asc.owned_tags.has(tag)) {
                    if (reason) {
                        reason.value = new SimpleFailedReason("Blocked tag found: " + tag);
                    }
                    return false;
                }
            }
        }

        if(to_check_effects) {
            for(let effect of to_check_effects) {
                if(!effect.TestAttach(reason)) {
                    if (reason) {
                        reason.value = new SimpleFailedReason("Effect not found: " + effect.effectTags.map(tag => tag.toString()).join(", "));
                    }
                    return false;
                }
            }
        }

        return true;
    }

    ability_instance_class(): typeof AbilityInstance{
        throw new Error("AbilitySpec.ability_instance_class() must be implemented");
    }

    ability_tags(): ITagName[]{
        throw new Error("AbilitySpec.ability_main_tag() must be implemented");
    }

    required_tags(): ITagName[]{
        return undefined;
    }

    blocked_tags(): ITagName[]{
        return undefined;
    }

    get_to_check_effects(): Effect[] {
        return undefined;
    }
}