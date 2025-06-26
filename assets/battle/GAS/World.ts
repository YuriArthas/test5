import { assert } from "cc";
import { GAS_Component, GAS_ComponentInitData, GAS_Node, Player, Team, UnitInitData } from "./Unit";
import { 属性预定义器 } from "./属性";
import { GAS_CreateStateEvent, GAS_PropertyChangedEvent, GAS_Object, GAS_RemoveStateEvent, GAS_SyncEvent, GAS_SyncEventType, IGAS_Object, GAS_Map, GAS_Set, GAS_Array, GAS_State, GAS_Property } from "./State";

export type ExtractInitDataType<T> = T extends { prototype: { init(init_data: infer U): void } } ? U : never;

export enum WorldRole {
    Server = 1,
    Client = 2,
    Multi = 3,
}

export interface WorldInitData extends UnitInitData {
    role: WorldRole;
    get_now_time: () => number;
}

@GAS_State
export class World extends GAS_Node {
    
    get owner_player(): Player {
        return this.player_0;
    }

    protected _id_top: number = 0;
    protected _player_id_top: number = -1;
    protected _rpc_request_id_top: number = 0;

    属性预定义器: 属性预定义器 = new 属性预定义器();

    id_state_maps: Map<number, IGAS_Object> = new Map();
    state_id_maps: Map<IGAS_Object, number> = new Map();

    // 一秒跑30物理帧, 每物理帧跑33逻辑帧(大约33, 实际可能会抖动)
    // 理论上每次物理帧结束才会发消息给客户端, 所以一次会带33个逻辑帧的消息
    // 不过如果逻辑帧已经积攒了足够一个MTU的数据, 也会提前发送已有数据
    sync_frame: number = 0;
    logic_frame: number = 0;

    last_update_time: number = 0;
    _time_accumulator: number = 0;

    @GAS_Property({type: Team})
    team_0: Team = undefined;

    @GAS_Property({type: Player})
    player_0: Player = undefined;  // default player

    @GAS_Property({type: GAS_Map})
    player_map: GAS_Map<number, Player> = undefined;

    
    private _role: WorldRole = undefined;
    get role(): WorldRole {
        return this._role;
    }

    syncer: WorldSyncer = undefined;

    get_now_time: () => number = undefined;

    constructor(trick_owner: GAS_Object, gas_id: number) {
        super(trick_owner as GAS_Object, gas_id);
        // trick之后, 设置正确的owner和world
        this.world = this;
        this.owner = this;
    }

    static create_world<T extends new (trick_owner: GAS_Object, gas_id: number) => World, InitData extends ExtractInitDataType<T>>(ObjectClass: T, init_data: InitData): InstanceType<T> {
        const trick_owner = {
            world: {
                add_id_state: (state: IGAS_Object, send_sync_event: boolean) => {
                    // do nothing
                }
            }
        }
        const world = new ObjectClass(trick_owner as GAS_Object, 0) as InstanceType<T>;
        world.init(init_data as any);
        world.syncGASState();
        world.onAddedToParent();
        world.add_id_state(world, false);
        return world;
    }

    init(init_data: WorldInitData) {
        super.init(init_data);
        this._role = init_data.role;

        this.player_map = this.create_map(this);
        this.player_map.set(this.player_0.player_id, this.player_0);

        this.team_0 = this.create_object(Team, {team_id: 0});
        this.player_0 = this.create_object(Player, {team: this.team_0});

        this.get_now_time = init_data.get_now_time;
        this.last_update_time = this.get_now_time();
    }

    is_ref_valid(ref: IGAS_Object): boolean {
        return this.id_state_maps.get(ref.gas_id) === ref;
    }

    add_id_state(state: IGAS_Object, send_sync_event: boolean = true) {
        this.id_state_maps.set(state.gas_id, state);
        this.state_id_maps.set(state, state.gas_id);
        if(send_sync_event) {
            const event: GAS_CreateStateEvent = {
                type: GAS_SyncEventType.CreateState,
                target: state,
            };
            this.syncer.on_self_state_changed(event);
        }
    }

    remove_id_state(state: IGAS_Object, send_sync_event: boolean = true) {
        this.id_state_maps.delete(state.gas_id);
        this.state_id_maps.delete(state);
        if(send_sync_event) {
            const event: GAS_RemoveStateEvent = {
                type: GAS_SyncEventType.RemoveState,
                target: state,
            };
            this.syncer.on_self_state_changed(event);
        }
    }

    apply_id() {
        return ++this._id_top;
    }

    apply_player_id() {
        return ++this._player_id_top;
    }

    apply_rpc_request_id() {
        return ++this._rpc_request_id_top;
    }

    update_logic_frame() {
        this.logic_frame++;
    }

    update_sync_frame() {
        this.sync_frame++;
    }

    update(){
        const now_time = this.get_now_time();
        const delta_time = now_time - this.last_update_time;
        this.last_update_time = now_time;

        this._time_accumulator += delta_time;

        const logic_frame_interval = 0.001;

        const max_steps = 165;
        let steps = 0;
        while(this._time_accumulator >= logic_frame_interval) {
            this.update_logic_frame();
            this._time_accumulator -= logic_frame_interval;
            steps++;
            if (steps >= max_steps) {
                this._time_accumulator = 0;
                break;
            }
        }

        this.update_sync_frame();
    }
}

export class WorldSyncer {

    client_networks: PlayerClientNetwork[] = [];
    server_networks: PlayerServerNetwork[] = [];

    init(init_data: any) {
        
    }

    on_self_state_changed(event: GAS_SyncEvent){

    }

    on_server_state_changed(event: GAS_SyncEvent) {
        
    }

    update(deltaTime: number) {

    }

}

export class PlayerClientNetwork extends GAS_Component {

}

export class PlayerServerNetwork extends GAS_Component {

}