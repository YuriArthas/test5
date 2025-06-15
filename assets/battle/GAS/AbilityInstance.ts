import { _decorator, Component } from "cc";
import { ASC } from "./AbilitySystemComponent";
import { AbilitySpec } from "./AbilitySpec";
import { Effect } from "./Effect";
import { FailedReasonContainer } from "./FailedReason";
import { Unit, UnitInitData } from "./Unit";
import { GAS_State, GAS_Object, IGAS_Object } from "./State";
import { IAttributeHost, IAttributeManager, AttributeManager } from "./属性";
import { World } from "./World";

const { ccclass, property } = _decorator;

export interface AbilityInstanceInitData {
    caster: Unit;
    target: any;
    ability_spec: AbilitySpec;
    to_check_effects?: Effect[];
}

@GAS_State
export class AbilityInstance extends GAS_Object implements IAttributeHost{
    _attribute_manager: AttributeManager = undefined;
    caster: Unit;  // ability_spec.caster和caster可能不是同一个
    target: any;
    ability_spec: AbilitySpec = undefined;
    to_check_effects: Effect[];

    get asc(): ASC {
        return this.caster.asc;
    }

    constructor(owner: GAS_Object, gas_id: number) {
        super(owner, gas_id);
        this._attribute_manager = this.create_object(AttributeManager, {attached_host: this});
    }

    init(init_data: AbilityInstanceInitData) {
        super.init(init_data);
        
        this.caster = init_data.caster;
        this.target = init_data.target;
        this.ability_spec = init_data.ability_spec;
        this.to_check_effects = init_data.to_check_effects;
    }

    get attribute_manager(): AttributeManager {
        return this._attribute_manager;
    }

    get attribute_manager_inherit(): IAttributeHost {
        return this.ability_spec;
    }
    
    _execute() {
        this.ability_spec.running_ability_instance_list.push(this);

        for(let tag of this.ability_spec.ability_tags()) {
            const ability_list = this.asc.tag_ability_map.get(tag);
            if(ability_list) {
                ability_list.push(this);
            } else {
                this.asc.tag_ability_map.set(tag, [this]);
            }
        }

        this.on_execute();
    }

    protected _clean_ability() {
        for(let effect of this.to_check_effects) {
            if(effect.durationType != "immediately" && effect.has_attached){
                effect.detach();
            }
        }

        this.ability_spec.running_ability_instance_list = this.ability_spec.running_ability_instance_list.filter(instance => instance !== this);

        for(let tag of this.ability_spec.ability_tags()) {
            const ability_list = this.asc.tag_ability_map.get(tag);
            if(ability_list) {
                if(ability_list.length == 1) {
                    this.asc.tag_ability_map.delete(tag);
                } else {
                    ability_list.splice(ability_list.indexOf(this), 1);
                }
            }
        }
    }

    protected commit(reason?: FailedReasonContainer): boolean {
        if(!this.ability_spec.can_cast(this.target, this.to_check_effects, reason)) {
            return false;
        }

        if(this.to_check_effects) {
            for(let effect of this.to_check_effects) {
                effect.attach();
            }
        }

        return true;
    }

    protected on_execute() {

    }
    protected end_ability() {
        this._clean_ability();
    }

    protected on_cancel() {

    }

    cancel_ability() {
        this.on_cancel();
        this.end_ability();
    }
    
}