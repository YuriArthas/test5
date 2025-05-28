import { _decorator, Component } from "cc";
import { GAS } from "./AbilitySystemComponent";

const { ccclass, property } = _decorator;

@ccclass('AbilityInstance')
export class AbilityInstance extends Component {
    abilitySystemComponent: GAS;
    
    onLoad() {
        this.abilitySystemComponent = this.getComponent(GAS);
    }


}