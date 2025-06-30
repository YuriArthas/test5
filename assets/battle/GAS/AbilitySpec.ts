import { AbilityInstance } from "./AbilityInstance";
import { ITagName } from "./AbilitySystemComponent";
import { Effect } from "./Effect";
import { FailedReason, FailedReasonContainer, SimpleFailedReason } from "./FailedReason";
import { GAS_Node } from "./Unit";
import { Vec2 } from "cc";
import { AttrFormula, Attribute, AttributeManager, BaseAttribute } from "./属性";
import { GAS_Object, GAS_State } from "./State";
import { World } from "./World";



export interface AbilitySpecInitData {
    owner: GAS_Node;
    attribute_manager?: AttributeManager;
}



@GAS_State
export class AbilitySpec extends GAS_Object {
    _attribute_manager: AttributeManager = undefined;
    get attribute_manager(): AttributeManager {
        return this._attribute_manager;
    }
    node: GAS_Node = undefined;
    running_ability_instance_list: AbilityInstance[] = [];

    init(init_data: AbilitySpecInitData) {
        if(init_data.attribute_manager) {
            this._attribute_manager = init_data.attribute_manager;
        } else {
            this._attribute_manager = this.world.create_object(AttributeManager, {attached_host: this});
        }
        
        this.node = init_data.owner;
    }

    get attribute_manager_inherit(): IAttributeHost {
        return this.node;
    }

    check_target(target: any, reason?: FailedReasonContainer): boolean {
        return true;
    }

    cast(target: any, reason?: FailedReasonContainer): boolean{
        let to_check_effects = this.get_to_check_effects();
        if(!this.can_cast(target, to_check_effects, reason)) {
            return false;
        }

        const ability_instance_class = this.ability_instance_class();
        const ability_instance = this.world.create_object(ability_instance_class, {
            caster: this.node,
            target: target,
            ability_spec: this,
            to_check_effects: to_check_effects,
        });
        
        ability_instance._execute();

        return true;
    }

    // return [can_cast, failed_effect]
    can_cast(target: any, to_check_effects?: Effect[], reason?: FailedReasonContainer): boolean{
        const check_type_result = this.check_target(target, reason);
        if(!check_type_result) {
            return false;
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