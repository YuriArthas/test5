import { AbilityInstance } from "./AbilityInstance";
import { ASC, ITagName } from "./AbilitySystemComponent";
import { Effect } from "./Effect";
import { FailedReason, FailedReasonContainer, SimpleFailedReason } from "./FailedReason";
import { Unit } from "./Unit";
import { Vec2 } from "cc";
import { Attribute } from "./属性";

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

export class AbilitySpec {

    asc: ASC;
    running_ability_instance_list: AbilityInstance[] = [];

    cast_range(): number {
        const attr = this.asc.get_attribute<Attribute>("施法距离");
        const cached_result = attr.cached_result();
        return Attribute.calc_final_value(attr.base_value, cached_result);
    }

    constructor(asc: ASC) {
        this.asc = asc;
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
        let ability_instance = new ability_instance_class(this.asc, this, target);
        ability_instance.to_check_effects = to_check_effects;

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
                if(!this.asc.owned_tags.has(tag)) {
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
                if(this.asc.owned_tags.has(tag)) {
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