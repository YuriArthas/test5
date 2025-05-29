import { ASC, GAS_BaseComponent } from "./AbilitySystemComponent";
import { _decorator, assert } from "cc";
import { Node } from "cc";
const { ccclass, property, requireComponent } = _decorator;

@ccclass('Unit')
@requireComponent(ASC)
export class Unit extends GAS_BaseComponent {
    asc: ASC;  // 每个Unit都必然有GAS

    OnLoad() {
        this.asc = this.getComponent(ASC);
        assert(this.asc != undefined, "Unit must have a GAS component");
        this.asc.unit = this;
    }
}

// 创建一个Unit, 并返回它, 脚本总是这样创建Unit
export function create_unit<T extends Unit>(UnitClassType: new ()=>T): T {
    const unitNode = new Node();
    const unit = unitNode.addComponent(UnitClassType);
    const asc = unitNode.addComponent(ASC);
    unit.asc = asc;
    asc.unit = unit;
    return unit;
}