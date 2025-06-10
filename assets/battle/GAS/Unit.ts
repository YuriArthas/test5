import { ASC } from "./AbilitySystemComponent";
import { _decorator, assert, Component } from "cc";
import { Node } from "cc";
 
import { 可被拖到Component } from "../可被拖到Component";
import { IAttributeHost, IAttributeManager, 属性预定义器 } from "./属性";
const { ccclass, property} = _decorator;

export interface UnitInitData {
    world: World;
    node?: Node;
    asc?: ASC;
}

export interface PlayerInitData extends UnitInitData {
    team: Team;
}

export interface TeamInitData extends UnitInitData {
    team_id: number;
}

export interface PawnInitData extends UnitInitData {
    player: Player;
}


export class GAS_BaseComponent extends Component {
    asc: ASC = undefined;
}

@ccclass('Unit')
export class Unit extends GAS_BaseComponent implements IAttributeHost {
    static InitDataType: new ()=> UnitInitData = undefined;
    get attribute_manager(): IAttributeManager {
        return this.asc;
    }
    asc: ASC = undefined;  // 每个Unit都必然有ASC
    id: number = undefined;


    init(init_data: UnitInitData) {
        const asc = init_data.asc?? new ASC();
        this.asc = asc;
        asc.unit = this;
        asc.world = init_data.world;
        
        this.id = init_data.world.id_counter++;
        asc.world.node_maps.set(this.id, this.node);
    }

    onDestroy() {
        this.asc.world.node_maps.delete(this.id);
    }
}



export class World extends Unit {
    static InitDataType: new ()=> UnitInitData = undefined;
    
    dragable_layer_map: Map<number, 可被拖到Component[]> = new Map();

    id_counter: number = 0;

    属性预定义器: 属性预定义器 = new 属性预定义器();

    node_maps: Map<number, Node> = new Map();

    init(init_data: UnitInitData) {
        assert(init_data.world == undefined, "创建world时, 不能传入world");
        init_data.world = this;
        super.init(init_data);
        this.asc.world = this;
        this.node_maps.set(this.id, this.node);
    }
}

export class Team extends Unit {
    static InitDataType: new ()=> TeamInitData = undefined;
    team_id: number = 0;

    init(init_data: TeamInitData) {
        super.init(init_data);
        this.team_id = init_data.team_id;
    }

    get attribute_manager_inherit(): IAttributeHost {
        return this.asc.world;
    }
}

export class Player extends Unit {
    static InitDataType: new ()=> PlayerInitData = undefined;

    team: Team = undefined;

    init(init_data: PlayerInitData) {
        super.init(init_data);
        this.team = init_data.team;
    }

    get attribute_manager_inherit(): IAttributeHost {
        return this.team;
    }
}

export class Pawn extends Unit {
    static InitDataType: new ()=> PawnInitData = undefined;
    
    player: Player = undefined;

    get attribute_manager_inherit(): IAttributeHost {
        return this.player;
    }

    init(init_data: PawnInitData) {
        super.init(init_data);
        this.player = init_data.player;
    }
}

type ExtractInitDataType<T> = T extends { prototype: { init(data: infer U): void } } ? U : never;

// 创建一个Unit, 并返回它, 脚本总是这样创建Unit
export function create_and_init<P extends { new (): { init(data: any): void } }>(UnitClassType: P, init_data: ExtractInitDataType<P>): InstanceType<P> {
    const unitNode = (init_data as any).node?? new Node();
    const unit = unitNode.addComponent(UnitClassType);
    unit.init(init_data);
    return unit as InstanceType<P>;
}
