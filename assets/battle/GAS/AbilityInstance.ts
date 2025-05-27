import { _decorator, Component } from "cc";
import { GAS_AbilitySystem } from "./AbilitySystemComponent";

const { ccclass, property } = _decorator;

@ccclass('AbilityInstance')
export class AbilityInstance extends Component {
    abilitySystemComponent: GAS_AbilitySystem;
    
    onLoad() {
        this.abilitySystemComponent = this.getComponent(GAS_AbilitySystem);
    }


}