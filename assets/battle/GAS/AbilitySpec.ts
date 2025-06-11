import { AbilityInstance } from "./AbilityInstance";
import { ASC, ITagName } from "./AbilitySystemComponent";
import { Effect } from "./Effect";
import { FailedReason, FailedReasonContainer, SimpleFailedReason } from "./FailedReason";
import { create_and_init, Unit, World } from "./Unit";
import { Vec2 } from "cc";
import { AttrFormula, Attribute, BaseAttribute, IAttributeHost, IAttributeManager } from "./属性";



export interface AbilitySpecInitData {
    owner: Unit;
    attribute_manager?: AbilitySpecAttributeManager;
}

export class AbilitySpecAttributeManager implements IAttributeManager {

    get_attribute<T extends BaseAttribute>(name: string, create_if_not_exist?: boolean): T {
        let attr = this.属性Map.get(name);
        if(attr) {
            return attr as T;
        }
        if(create_if_not_exist) {
            attr = this.world.属性预定义器.创建(name, this);
            this.属性Map.set(name, attr);
        }
        return attr as T;
    }

    world: World = undefined;
    attached_host: IAttributeHost = undefined;
    属性Map: Map<string, BaseAttribute> = new Map();
}

export class AbilitySpec implements IAttributeHost {
    get_attribute_manager: AbilitySpecAttributeManager = undefined;
    owner: Unit = undefined;
    running_ability_instance_list: AbilityInstance[] = [];

    init(init_data: AbilitySpecInitData) {
        if(init_data.attribute_manager) {
            this.get_attribute_manager = init_data.attribute_manager;
        } else {
            this.get_attribute_manager = new AbilitySpecAttributeManager();
            this.get_attribute_manager.world = init_data.owner.asc.world;
            this.get_attribute_manager.attached_host = this;
        }
        
        this.owner = init_data.owner;
    }

    get get_attribute_manager_inherit(): IAttributeHost {
        return this.owner;
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
    can_cast(target: any, to_check_effects?: Effect[], reason?: FailedReasonContainer): boolean{
        const check_type_result = this.check_target(target, reason);
        if(!check_type_result) {
            return false;
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