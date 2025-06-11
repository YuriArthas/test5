import { _decorator, assert, assetManager, Button, CCInteger, Component, instantiate, Node, Prefab, UITransform, Vec2, Vec3 } from 'cc';
import { 局数据 } from './存档';
import { 牌数据 } from './牌数据';
import { 静态配置 } from '../静态配置';
import { Attribute, AttrFomulaResult, AttrSourceCollection, BaseAttribute } from './GAS/属性';
import resourceManager from './ResourceManager';
import { 牌, 牌可拖到Layer, 牌状态 } from './牌';
import { ASC } from './GAS/AbilitySystemComponent';
import { Player, Team, Pawn, UnitInitData, create_and_init, Unit } from './GAS/Unit';
import { World } from './GAS/World';
import { 可被拖到Component } from './可被拖到Component';
import { DragEndBehavior, 可拖动Component } from './可拖动Component';
import { BaseCharacter, BaseCharacterInitData } from './pawns/BaseCharacter';
const { ccclass, property } = _decorator;

export class AbilityTarget {
    target: Unit|Vec2|undefined|any = undefined;
}

export enum AbilityTargetType {
    NONE = 0,
    Unit = 1,
    Point = 2,
    NO_TARGET = 4,
}

export enum AbilitySpecAttrEnum {
    最大施法距离 = "最大施法距离",
    冷却时间 = "冷却时间",
}

export enum AttrEnum {
    最大施法距离 = AbilitySpecAttrEnum.最大施法距离,
    冷却时间 = AbilitySpecAttrEnum.冷却时间,
    生命 = "生命",
    生命最大值 = "生命最大值",
    骰子最小数量 = "骰子最小数量",
    骰子最大数量 = "骰子最大数量",

}


class BattleInitData {
    public 骰子数量: number = 0;
}

@ccclass('battle')
export class battle extends Component {
    @property(Node)
    public 战斗区域: Node = null;

    @property(Node)
    public 工作区域: Node = null;

    @property(Node)
    public 合成区域: Node = null;

    @property(Node)
    public 牌物品栏: Node = null;

    @property(Node)
    public 随机按钮: Node = null;

    @property(Node)
    public 牌确认按钮: Node = null;

    @property(Node)
    public 合成按钮: Node = null;

    @property(Node)
    public 合成结果显示面板: Node = null;

    @property(Node)
    public 战斗开始按钮: Node = null;

    @property(Node)
    public 第一次注入牌按钮: Node = null;

    @property(CCInteger)
    public 随机数种子: number = 0;

    @property(Node)
    public 合成物品栏: Node = null;

    public world: BattleWorld = undefined;

    

    生成局数据() {
        return {
            battle: true,
            work: true,
            craft: true,
            dice: true
        }
    }

    initBattle(data: 局数据) {
        this.world.局数据 = data;
    }

    protected async onLoad(): Promise<void> {
        // const 牌数据Map = 静态配置.instance.牌数据Map;
        // await resourceManager.loadAll<Prefab>(Array.from(牌数据Map.values()).map(card => card.prefab));

        this.world = create_and_init(BattleWorld, {world: undefined, node: this.node});
        this.world.battle = this;

        console.log("loadAll finished");
    }
    
    start() {
        if (!this.world.局数据){
            this.initBattle(this.生成局数据());
        }

        if(this.随机数种子 == 0){
            this.随机数种子 = Math.floor(Math.random() * 1000000);
        }

        // this.合成区域.active = false;

        this.第一次注入牌按钮.on(Button.EventType.CLICK, this.on_第一次注入牌按钮_click, this);
        this.随机按钮.on(Button.EventType.CLICK, this.on_随机按钮_click, this);
        this.牌确认按钮.on(Button.EventType.CLICK, this.on_牌确认按钮_click, this);
        this.合成按钮.on(Button.EventType.CLICK, this.on_合成按钮_click, this);
        this.战斗开始按钮.on(Button.EventType.CLICK, this.on_战斗开始按钮_click, this);

        this.合成按钮.getComponent(Button).interactable = false;

        this.牌物品栏.addComponent(可被拖到Component);
        this.牌物品栏.getComponent(可被拖到Component).world = this.world;
        this.牌物品栏.getComponent(可被拖到Component).setLayer(2);
        this.牌物品栏.getComponent(可被拖到Component).onDragDrop = (draggable: 可拖动Component): void => {
            const card = draggable.node.getComponent(牌);
            if(!card){
                assert(false, "牌物品栏中不应该有非牌的节点");
            }
            draggable.clearRollbackInfo();
            card.牌状态 = 牌状态.在牌物品栏;
            draggable.node.setParent(this.牌物品栏);
            draggable.node.setPosition(0, 0, 0);
        } 

        for(let i = 0; i < 3; i++){
            const 合成槽位 = resourceManager.get_assets<Prefab>(静态配置.instance.合成槽位prefab_path);

            const 合成槽位实例 = instantiate(合成槽位);
            const 可被拖到 = 合成槽位实例.addComponent(可被拖到Component);
            可被拖到.world = this.world;
            可被拖到.setLayer(牌可拖到Layer.合成区域);
            可被拖到.onDragDrop = (draggable: 可拖动Component): void => {
                for(let elem of 合成槽位实例.children){
                    if(elem.getComponent(牌)){
                        return;
                    }
                }
                const card = draggable.node.getComponent(牌);
                if(!card){
                    assert(false, "合成槽位中不应该有非牌的节点");
                }

                // draggable.dragEndBehavior = DragEndBehavior.STAY_AT_DROP_POSITION;
                draggable.node.setParent(合成槽位实例);
                draggable.node.setPosition(0, 0, 0);
                card.牌状态 = 牌状态.在合成区域;
                draggable.clearRollbackInfo();
            }
            this.合成物品栏.addChild(合成槽位实例);

            this.on_战斗开始按钮_click();
        }
    }

    do_random_card(count: number){
        const 所有牌数据 = Array.from(静态配置.instance.牌数据Map.values());
        
        for(let i = 0; i < count; i++){
            const 随机索引 = this.random_int(0, 所有牌数据.length);
            const 随机牌数据 = 所有牌数据[随机索引];
            const card = 随机牌数据.create_card(this.world, this.world.player_0);
            this.牌物品栏.addChild(card.node);
            card.牌状态 = 牌状态.在牌物品栏;
            
            
            // card.node.on(Button.EventType.CLICK, () => {this.on_牌_click(card)}, this);
            if(i == 0){

                card.node.setPosition(100, 0, 0);
            }
        }

        
    }

    on_第一次注入牌按钮_click() {
        this.第一次注入牌按钮.active = false;

        // 简单的清理方式：清理所有以当前组件为target的"牌被点击"事件
        this.node.targetOff(this);

        const count = this.random_int(this.world.player_0.asc.属性Map.get("骰子最小数量").value(), this.world.player_0.asc.属性Map.get("骰子最大数量").value() + 1);
        
        this.do_random_card(count);
    }

    refresh_合成结果(){
        const old = this.合成结果显示面板.getChildByName("合成结果");
        if(old){
            old.destroy();
        }

        const 合成结果 = 牌数据.尝试合成(this.合成物品栏.children.map(child => child.getComponent(牌).牌数据));
        if(合成结果){
            const 合成结果牌 = 合成结果.create_card(this.world, this.world.player_0);
            合成结果牌.getComponent(牌).牌状态 = 牌状态.在合成结果显示面板;
            合成结果牌.name = "合成结果";
            合成结果牌.node.setParent(this.合成结果显示面板);
            this.合成按钮.getComponent(Button).interactable = true;
        }else{
            this.合成按钮.getComponent(Button).interactable = false;
        }

    }

    /**
     * 处理牌被点击的事件
     */
    on_牌_click(card: 牌) {
        
        if(card.牌状态 == 牌状态.在牌物品栏){
            if(this.合成物品栏.children.length < 3){
                card.牌状态 = 牌状态.在合成区域;
                card.node.setParent(this.合成物品栏);
                this.refresh_合成结果();
            }
        }else if(card.牌状态 == 牌状态.在合成区域){
            card.牌状态 = 牌状态.在牌物品栏;
            card.node.setParent(this.牌物品栏);
            this.refresh_合成结果();
        }
    }

    on_牌确认按钮_click() {
        this.牌确认按钮.active = false;
        this.随机按钮.active = false;
        this.合成区域.active = true;
    }

    on_合成按钮_click() {
        const card = this.合成结果显示面板.getChildByName("合成结果");
        if(card){
            card.setParent(this.牌物品栏);
            card.getComponent(牌).牌状态 = 牌状态.在牌物品栏;
            const arr = this.合成物品栏.children.map(child => child);
            arr.forEach(child => {
                child.destroy();
            });
        }
    }

    /**
     * 递归查找指定名称的子节点
     */
    private findChildRecursively(parent: Node, name: string): Node | null {
        // 首先检查直接子节点
        for (let child of parent.children) {
            if (child.name === name) {
                return child;
            }
        }
        
        // 如果直接子节点中没找到，递归查找每个子节点的子节点
        for (let child of parent.children) {
            const found = this.findChildRecursively(child, name);
            if (found) {
                return found;
            }
        }
        
        return null;
    }

    /**
     * 根据路径查找子节点，支持用"/"分割的字符串路径或字符串数组路径
     * @param parent 父节点
     * @param path 路径，可以是字符串如 "child1/child2/child3" 或字符串数组如 ["child1", "child2", "child3"]
     * @returns 找到的节点或undefined
     */
    private GetChildByName(parent: Node, path: string | string[]): Node | undefined {
        if (!path) {
            return parent;
        }

        let pathParts: string[];
        
        if (typeof path === 'string') {
            if (path.trim() === "") {
                return parent;
            }
            pathParts = path.split('/').filter(part => part.trim() !== '');
        } else {
            // path 是字符串数组
            pathParts = path.filter(part => part && part.trim() !== '');
        }
        
        if (pathParts.length === 0) {
            return parent;
        }
        
        let currentNode = parent;
        for (const partName of pathParts) {
            const found = currentNode.getChildByName(partName);
            if (!found) {
                return undefined;
            }
            currentNode = found;
        }
        
        return currentNode;
    }

    

    on_战斗开始按钮_click() {
        this.战斗开始按钮.active = false;
        const hero_position = this.findChildRecursively(this.node, "hero_position");

        const hero_config = 静态配置.instance.单位数据Map.get("英雄1");

        const heroUnit = instantiate(resourceManager.get_assets<Prefab>(hero_config.prefab));
        heroUnit.setParent(hero_position.parent);
        heroUnit.setPosition(hero_position.position);

        const hero = create_and_init(hero_config.pawn_class, {
            world: this.world,
            node: heroUnit,
            player: this.world.player_0,
            unit_data: hero_config,
        });
    
        
    }

    on_随机按钮_click() {
        const count = this.牌物品栏.children.length;
        [...this.牌物品栏.children].forEach(child => {
            child.destroy();
        });
        
        this.do_random_card(count);
    }

    /**
     * 组件销毁时清理所有事件监听
     */
    protected onDestroy(): void {
        // 清理所有以当前组件为target的事件监听
        this.node.targetOff(this);
    }

    update(deltaTime: number) {
        
    }

    private random(): number {
        this.随机数种子 = (1103515245 * this.随机数种子 + 12345) & 0x7fffffff;
        return this.随机数种子;
    }

    private random_int(a: number, b: number): number {
        return Math.floor(this.random() / 0x7fffffff * (b - a)) + a;
    }
}

export class BattleWorld extends World {
    battle: battle = undefined;

    dragable_layer_map: Map<number, 可被拖到Component[]> = new Map();

    node_maps: Map<number, Node> = new Map();
    
    public team_0: Team = undefined;

    public team_1: Team = undefined;

    public player_0: Player = undefined;

    public player_1: Player = undefined;

    public 局数据: 局数据 = undefined;

    public 牌数据Map: Map<string, 牌数据> = new Map();

    init(init_data: UnitInitData){
        super.init(init_data);
        this.init_attr_register();

        this.team_0 = create_and_init(Team, {world: this, team_id: 0});
        this.team_0.node.setParent(this.node);

        this.team_1 = create_and_init(Team, {world: this, team_id: 1});
        this.team_1.node.setParent(this.node);

        this.player_0 = create_and_init(Player, {world: this, team: this.team_0});
        this.player_0.node.setParent(this.node);

        this.player_1 = create_and_init(Player, {world: this, team: this.team_1});
        this.player_1.node.setParent(this.node);

        this.player_0.asc.属性Map.set("骰子最小数量", this.属性预定义器.创建("骰子最小数量", this.player_0.asc));
        this.player_0.asc.属性Map.set("骰子最大数量", this.属性预定义器.创建("骰子最大数量", this.player_0.asc));

    }

    

    init_attr_register(){

        

        this.属性预定义器.注册(AttrEnum.骰子最小数量, {attr_class: Attribute, base_value: 静态配置.instance.骰子个数基础最小值});

        this.属性预定义器.注册(AttrEnum.骰子最大数量, {attr_class: Attribute, base_value: 静态配置.instance.骰子个数基础最大值});

        this.属性预定义器.注册(AttrEnum.生命, {attr_class: Attribute, base_value: 1});

        this.属性预定义器.注册(AttrEnum.生命最大值, {attr_class: Attribute, base_value: 1});

        this.属性预定义器.注册(AttrEnum.最大施法距离, {attr_class: Attribute, base_value: 20});

        this.属性预定义器.注册(AttrEnum.冷却时间, {attr_class: Attribute, base_value: 0});



        
    }

    
}
