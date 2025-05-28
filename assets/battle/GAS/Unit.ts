import { GAS, GAS_BaseComponent } from "./AbilitySystemComponent";
import { _decorator, assert } from "cc";
import { Node } from "cc";
const { ccclass, property, requireComponent } = _decorator;

@ccclass('Unit')
@requireComponent(GAS)
export class Unit extends GAS_BaseComponent {
    gas: GAS;  // 每个Unit都必然有GAS

    OnLoad() {
        this.gas = this.getComponent(GAS);
        assert(this.gas != undefined, "Unit must have a GAS component");
        this.gas.unit = this;
    }
}

// 创建一个Unit, 并返回它, 脚本总是这样创建Unit
export function create_unit<T extends Unit>(UnitClassType: new ()=>T): T {
    const unitNode = new Node();
    const unit = unitNode.addComponent(UnitClassType);
    const gas = unitNode.addComponent(GAS);
    unit.gas = gas;
    gas.unit = unit;
    return unit;
}