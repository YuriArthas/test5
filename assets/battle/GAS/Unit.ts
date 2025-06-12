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
    active: boolean = true;
    private _activeInHierarchy: boolean = false;
    private _hasLoaded: boolean = false;
    private _hasStarted: boolean = false;

    init(init_data: GAS_NodeInitData) {
        this.id = ++init_data.world.id_counter;
        init_data.world.id_node_maps.set(this.id, this);
        init_data.world.node_id_maps.set(this, this.id);
        this.world = init_data.world;
        this._updateActiveInHierarchy();
    }

    add_component<T extends GAS_Component & { init(data: any): void }>(ComponentType: new () => T, init_data: ExtractInitDataType<typeof ComponentType>): T {
        const component = new ComponentType();
        this.components.push(component);
        component.init(init_data);
        
        return component;
    }

    add_child(child: GAS_Node) {
        if (child.parent) {
            child.parent.remove_child(child);
        }
        this.children.push(child);
        child.parent = this;
        child.onAddedToParent();
        child._updateActiveInHierarchy();
    }

    remove_child(child: GAS_Node) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = undefined;
            child._updateActiveInHierarchy();
            child.onRemovedFromParent();
        }
    }

    set_parent(parent: GAS_Node) {
        if (parent) {
            parent.add_child(this);
        } else if (this.parent) {
            this.parent.remove_child(this);
        }
    }

    onLoad() {
        if (this._hasLoaded) return;
        this._hasLoaded = true;
        
        for (const component of this.components) {
            component.onLoad();
        }
        for (const child of this.children) {
            child.onLoad();
        }
    }

    start() {
        if (this._hasStarted) return;
        this._hasStarted = true;
        
        for (const component of this.components) {
            component.start();
        }
        for (const child of this.children) {
            child.start();
        }
    }

    update(deltaTime: number) {
        if (!this._activeInHierarchy) return;
        
        for (const component of this.components) {
            component.update(deltaTime);
        }
        for (const child of this.children) {
            child.update(deltaTime);
        }
    }

    setActive(active: boolean) {
        if (this.active === active) return;
        
        this.active = active;
        this._updateActiveInHierarchy();
    }

    private _updateActiveInHierarchy() {
        const newActiveInHierarchy = this.active && (this.parent === undefined || this.parent._activeInHierarchy);
        
        if (this._activeInHierarchy === newActiveInHierarchy) return;
        
        this._activeInHierarchy = newActiveInHierarchy;
        
        if (newActiveInHierarchy) {
            this.onEnable();
        } else {
            this.onDisable();
        }
        
        for (const child of this.children) {
            child._updateActiveInHierarchy();
        }
    }

    isActiveInHierarchy(): boolean {
        return this._activeInHierarchy;
    }

    onEnable() {
        if (!this._hasStarted) {
            this.start();
        }
        for (const component of this.components) {
            component.onEnable();
        }
    }

    onDisable() {
        for (const component of this.components) {
            component.onDisable();
        }
    }

    onAddedToParent() {
        this.onLoad();
    }

    onRemovedFromParent() {
        
    }

    onDestroy() {
        // Detach from parent first.
        if (this.parent) {
            this.parent.remove_child(this);
        }

        // Destroy children recursively.
        // A copy is needed because child.onDestroy() will modify this.children.
        const childrenToDestroy = [...this.children];
        for (const child of childrenToDestroy) {
            child.onDestroy();
        }

        // Unregister from world.
        if (this.world) {
            this.world.id_node_maps.delete(this.id);
            this.world.node_id_maps.delete(this);
        }

        // Destroy components.
        for (const component of this.components) {
            component.onDestroy();
        }
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

    onLoad() {
        
    }

    start() {
        
    }

    update(deltaTime: number) {
        
    }

    onEnable() {
        
    }

    onDisable() {
        
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
        super.init(init_data);
        const asc = init_data.asc?? new ASC();
        this.asc = asc;
        asc.unit = this;
        asc.world = this.world;
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
