import { ASC } from "./AbilitySystemComponent";
import { _decorator, assert, Component } from "cc";
import { Node } from "cc";
import { World } from "./World";
import { 可被拖到Component } from "../可被拖到Component";
import { IAttributeHost, IAttributeManager, 属性预定义器 } from "./属性";
const { ccclass, property} = _decorator;

type ExtractInitDataType<T> = T extends { prototype: { init(data: infer U): void } } ? U : never;

export interface GAS_NodeInitData {
    world: World;
}

export interface UnitInitData extends GAS_NodeInitData {
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

export interface ILinkedNode {

}

export interface ILinkedComponent {

}

export class GAS_Node {
    world: World = undefined;
    components: GAS_Component[] = [];
    parent: GAS_Node = undefined;
    children: GAS_Node[] = [];
    id: number = undefined;

    add_component<T extends GAS_Component & { init(data: any): void }>(ComponentType: new () => T, init_data: ExtractInitDataType<typeof ComponentType>): T {
        const component = new ComponentType();
        this.components.push(component);
        component.init(init_data);
        
        return component;
    }

    add_child(child: GAS_Node) {
        this.children.push(child);
        child.parent = this;
    }

    set_parent(parent: GAS_Node) {
        if(this.parent) {
            this.parent.children.splice(this.parent.children.indexOf(this), 1);
        }
        this.parent = parent;
        this.parent.children.push(this);
    }

    onDestroy() {
        this.world.unit_maps.delete(this.id);
    }
}

export interface GAS_ComponentInitData {
    owner: GAS_Node;
}

export class GAS_Component {
    owner: GAS_Node = undefined;

    init(init_data: GAS_ComponentInitData) {
        this.owner = init_data.owner;
    }

    onDestroy() {

    }
}

export class Unit extends GAS_Node implements IAttributeHost {
    static InitDataType: new ()=> UnitInitData = undefined;

    get_attribute_manager(): IAttributeManager {
        return this.asc;
    }
    get_attribute_manager_inherit(): IAttributeHost {
        return undefined;
    }

    asc: ASC = undefined;  // 每个Unit都必然有ASC



    init(init_data: UnitInitData) {
        const asc = init_data.asc?? new ASC();
        this.asc = asc;
        asc.unit = this;
        asc.world = init_data.world;
        this.world = init_data.world;
        this.id = init_data.world.id_counter++;
        asc.world.unit_maps.set(this.id, this);
    }

    
}


export class Team extends Unit {
    static InitDataType: new ()=> TeamInitData = undefined;
    team_id: number = 0;

    init(init_data: TeamInitData) {
        super.init(init_data);
        this.team_id = init_data.team_id;
    }

    get_attribute_manager_inherit(): IAttributeHost {
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

    get_attribute_manager_inherit(): IAttributeHost {
        return this.team;
    }
}

export class Pawn extends Unit {
    static InitDataType: new ()=> PawnInitData = undefined;
    
    player: Player = undefined;

    get_attribute_manager_inherit(): IAttributeHost {
        return this.player;
    }

    init(init_data: PawnInitData) {
        super.init(init_data);
        this.player = init_data.player;
    }
}



// 创建一个Unit, 并返回它, 脚本总是这样创建Unit
export function create_and_init<P extends { new (): { init(data: any): void } }>(UnitClassType: P, init_data: ExtractInitDataType<P>): InstanceType<P> {
    const unitNode = (init_data as any).node?? new Node();
    const unit = unitNode.addComponent(UnitClassType);
    unit.init(init_data);
    return unit as InstanceType<P>;
}
