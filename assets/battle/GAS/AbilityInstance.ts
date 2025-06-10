import { _decorator, Component } from "cc";
import { ASC } from "./AbilitySystemComponent";
import { AbilitySpec, AbilityTarget } from "./AbilitySpec";
import { Effect } from "./Effect";
import { FailedReasonContainer } from "./FailedReason";
import { Unit, UnitInitData } from "./Unit";

const { ccclass, property } = _decorator;

export interface AbilityInstanceInitData extends UnitInitData {
    caster: Unit;
    target: AbilityTarget;
    ability_spec: AbilitySpec;
    to_check_effects?: Effect[];
}

export class AbilityInstance extends Unit{
    asc: ASC;
    caster: Unit;  // ability_spec.caster和caster可能不是同一个
    target: AbilityTarget;
    ability_spec: AbilitySpec;
    to_check_effects: Effect[];

    init(init_data: AbilityInstanceInitData) {
        super.init(init_data);
        this.asc = init_data.asc;
        this.caster = init_data.caster;
        this.target = init_data.target;
        this.ability_spec = init_data.ability_spec;
        this.to_check_effects = init_data.to_check_effects;
    }
    
    _active() {
        this.ability_spec.running_ability_instance_list.push(this);

        for(let tag of this.ability_spec.ability_tags()) {
            const ability_list = this.asc.tag_ability_map.get(tag);
            if(ability_list) {
                ability_list.push(this);
            } else {
                this.asc.tag_ability_map.set(tag, [this]);
            }
        }

        this.active();
    }

    protected _clean_ability() {
        for(let effect of this.to_check_effects) {
            if(effect.durationType != "immediately" && effect.attached){
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

    protected active() {}

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