import { assert } from "cc";
import { GAS_Component, GAS_ComponentInitData, GAS_Node, Player, Unit, UnitInitData } from "./Unit";
import { 属性预定义器 } from "./属性";
import { GAS_PropertyChangedEvent, GAS_SyncEventType, GASStateful } from "./State";

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

    id_state_maps: Map<number, GASStateful> = new Map();
    state_id_maps: Map<GASStateful, number> = new Map();

    // 一秒跑30物理帧, 每物理帧跑33逻辑帧
    // 理论上每次物理帧结束才会发消息给客户端, 所以一次会带33个逻辑帧的消息
    // 不过如果逻辑帧已经积攒了足够一个MTU的数据, 也会提前发送已有数据
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

    add_id_state(id: number, state: GASStateful, send_sync_event: boolean = true) {
        this.id_state_maps.set(id, state);
        this.state_id_maps.set(state, id);
        if(send_sync_event) {
            this.syncer.on_self_state_changed({
                type: GAS_SyncEventType.CreateState,
                target: state,
                propertyName: id,
                newValue: state,
                
            });
        }
    }

    update(){

    }
}

export class WorldSyncer {
    static InitDataType: new ()=> WorldInitData = undefined;

    client_networks: PlayerClientNetwork[] = [];
    server_networks: PlayerServerNetwork[] = [];

    init(init_data: any) {
        
    }

    on_self_state_changed(event: GAS_PropertyChangedEvent){

    }

    on_server_state_changed(event: GAS_PropertyChangedEvent) {
        
    }

    update(deltaTime: number) {

    }

}

export class PlayerClientNetwork extends GAS_Component {

}

export class PlayerServerNetwork extends GAS_Component {

}