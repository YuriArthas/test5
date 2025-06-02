import { _decorator, assert, assetManager, Button, CCInteger, Component, instantiate, Node, Prefab, UITransform, Vec3 } from 'cc';
import { 局数据 } from './存档';
import { 牌数据 } from './牌数据';
import { 静态配置 } from '../静态配置';
import { Attr, BaseAttr } from './GAS/属性';
import resourceManager from './ResourceManager';
import { 牌, 牌状态 } from './牌';
import { ASC } from './GAS/AbilitySystemComponent';
import { create_unit, Unit } from './GAS/Unit';
import { create_player, Player } from './GAS/Player';
import { create_world, World } from './GAS/World';
import { create_team, Team } from './GAS/Team';
const { ccclass, property } = _decorator;

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

    public world: World = undefined;

    public team_0: Team = undefined;

    public team_1: Team = undefined;

    public player_0: Player = undefined;

    public player_1: Player = undefined;

    private 局数据: 局数据 = undefined;

    生成局数据() {
        return {
            battle: true,
            work: true,
            craft: true,
            dice: true
        }
    }

    initBattle(data: 局数据) {
        this.局数据 = data;
    }

    protected async onLoad(): Promise<void> {
        const 牌数据Map = 静态配置.instance.牌数据Map;
        await resourceManager.loadAll<Prefab>(Array.from(牌数据Map.values()).map(card => card.prefab));

        this.world = create_world(World);
        this.world.node.setParent(this.node);

        this.team_0 = create_team(Team, 0);
        this.team_0.node.setParent(this.node);

        this.team_1 = create_team(Team, 1);
        this.team_1.node.setParent(this.node);

        this.player_0 = create_player(Player, this.team_0);
        this.player_0.node.setParent(this.node);

        this.player_1 = create_player(Player, this.team_1);
        this.player_1.node.setParent(this.node);

        this.player_0.asc.属性Map.set("骰子最小数量", new Attr(this.player_0.asc, undefined, 静态配置.instance.骰子个数基础最小值));
        this.player_0.asc.属性Map.set("骰子最大数量", new Attr(this.player_0.asc, undefined, 静态配置.instance.骰子个数基础最大值));

        console.log("loadAll finished");
    }
    
    start() {
        if (!this.局数据){
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
    }

    do_random_card(count: number){
        const 所有牌数据 = Array.from(静态配置.instance.牌数据Map.values());
        
        for(let i = 0; i < count; i++){
            const 随机索引 = this.random_int(0, 所有牌数据.length);
            const 随机牌数据 = 所有牌数据[随机索引];
            const card = 随机牌数据.create_card(this.world, this.player_0);
            this.牌物品栏.addChild(card.node);
            card.牌状态 = 牌状态.在牌物品栏;
            
            card.node.on(Button.EventType.CLICK, () => {this.on_牌_click(card)}, this);
            if(i == 0){

                card.node.setPosition(100, 0, 0);
            }
        }

        
    }

    on_第一次注入牌按钮_click() {
        this.第一次注入牌按钮.active = false;

        // 简单的清理方式：清理所有以当前组件为target的"牌被点击"事件
        this.node.targetOff(this);

        const count = this.random_int(this.player_0.asc.属性Map.get("骰子最小数量").value(), this.player_0.asc.属性Map.get("骰子最大数量").value() + 1);
        
        this.do_random_card(count);
    }

    refresh_合成结果(){
        const old = this.合成结果显示面板.getChildByName("合成结果");
        if(old){
            old.destroy();
        }

        const 合成结果 = 牌数据.尝试合成(this.合成物品栏.children.map(child => child.getComponent(牌).牌数据));
        if(合成结果){
            const 合成结果牌 = 合成结果.create_card(this.world, this.player_0);
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

    on_战斗开始按钮_click() {

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


