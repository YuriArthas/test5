import { assert } from "cc";
import { GAS_Component, GAS_Node, Unit, UnitInitData } from "./Unit";
import { 属性预定义器 } from "./属性";

export class World extends Unit {
    static InitDataType: new ()=> UnitInitData = undefined;

    id_counter: number = 0;

    属性预定义器: 属性预定义器 = new 属性预定义器();

    id_node_maps: Map<number, GAS_Node> = new Map();
    node_id_maps: Map<GAS_Node, number> = new Map();

    id_component_maps: Map<number, GAS_Component> = new Map();
    component_id_maps: Map<GAS_Component, number> = new Map();

    init(init_data: UnitInitData) {
        assert(init_data.world == undefined, "创建world时, 不能传入world");
        init_data.world = this;
        super.init(init_data);
        
    }
}