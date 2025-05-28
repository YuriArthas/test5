import { GAS, GAS_BaseComponent } from "./AbilitySystemComponent";
import { _decorator } from "cc";
import { Node } from "cc";
const { ccclass, property } = _decorator;

@ccclass('Unit')
export class Unit extends GAS_BaseComponent {    
    gas: GAS = undefined;
}

export function create_unit<T extends Unit>(UnitClassType: new ()=>T): T {
    const unitNode = new Node();
    const unit = unitNode.addComponent(UnitClassType);
    const gas = unitNode.addComponent(GAS);
    unit.gas = gas;
    return unit;
}