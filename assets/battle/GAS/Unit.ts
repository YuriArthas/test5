import { ASC, GAS_BaseComponent } from "./AbilitySystemComponent";
import { _decorator, assert } from "cc";
import { Node } from "cc";
import { World } from "./World";
const { ccclass, property, requireComponent } = _decorator;

@ccclass('Unit')
@requireComponent(ASC)
export class Unit extends GAS_BaseComponent {
    asc: ASC = undefined;  // 每个Unit都必然有ASC
}

// 创建一个Unit, 并返回它, 脚本总是这样创建Unit
export function create_unit<T extends Unit>(UnitClassType: new ()=>T, node?: Node): T {
    const unitNode = node?? new Node();
    const unit = unitNode.addComponent(UnitClassType);
    const gas = unitNode.addComponent(ASC);
    unit.asc = gas;
    gas.unit = unit;
    return unit;
}
 