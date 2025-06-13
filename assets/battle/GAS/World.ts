import { assert } from "cc";
import { GAS_Component, GAS_ComponentInitData, GAS_Node, Player, Unit, UnitInitData } from "./Unit";
import { 属性预定义器 } from "./属性";

export enum WorldRole {
    Server,
    Client,
}

export interface WorldInitData extends UnitInitData {
    role: WorldRole;
}

export class World extends Unit {
    static InitDataType: new ()=> UnitInitData = undefined;

    id_counter: number = 0;

    属性预定义器: 属性预定义器 = new 属性预定义器();

    id_node_maps: Map<number, GAS_Node> = new Map();
    node_id_maps: Map<GAS_Node, number> = new Map();

    id_component_maps: Map<number, GAS_Component> = new Map();
    component_id_maps: Map<GAS_Component, number> = new Map();

    sync_frame: number = 0;
    logic_frame: number = 0;

    role: WorldRole = undefined;

    

    syncer: WorldSyncer = undefined;

    init(init_data: WorldInitData) {
        assert(init_data.world == undefined, "创建world时, 不能传入world");
        init_data.world = this;
        super.init(init_data);
        this.role = init_data.role;
    }



    update(){

    }
}

export class WorldSyncer extends GAS_Component {
    static InitDataType: new ()=> WorldInitData = undefined;

    client_networks: PlayerClientNetwork[] = [];
    server_networks: PlayerServerNetwork[] = [];

    init(init_data: GAS_ComponentInitData) {
        super.init(init_data);
    }

    on_self_state_changed(){

    }

    on_server_state_changed() {
        
    }

    update(deltaTime: number) {

    }

}

export class PlayerClientNetwork extends GAS_Component {

}

export class PlayerServerNetwork extends GAS_Component {

}