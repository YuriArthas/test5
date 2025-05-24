import { _decorator, Button, Component, Node } from 'cc';
import { dice, 骰子数据 } from '../牌/牌';
import { 局数据 } from './存档';
const { ccclass, property } = _decorator;



class 骰子总表 {
    public 骰子数据: 骰子数据[] = [
        {
            id: 1,
            name: "骰子1",
            image: "骰子1.png",
            description: "骰子1描述",
            price: 100
        }
    ];
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
    public 合成槽位0: Node = null;

    @property(Node)
    public 合成槽位1: Node = null;

    @property(Node)
    public 合成槽位2: Node = null;

    @property(Node)
    public 战斗开始按钮: Node = null;

    @property(Node)
    public 第一次注入牌按钮: Node = null;

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
    
    start() {
        if (!this.局数据){
            this.initBattle(this.生成局数据());
        }

        this.合成区域.active = false;

        this.第一次注入牌按钮.on(Button.EventType.CLICK, this.on_第一次注入牌按钮_click, this);
        this.随机按钮.on(Button.EventType.CLICK, this.on_随机按钮_click, this);
        this.牌确认按钮.on(Button.EventType.CLICK, this.on_牌确认按钮_click, this);
        this.合成按钮.on(Button.EventType.CLICK, this.on_合成按钮_click, this);
        this.战斗开始按钮.on(Button.EventType.CLICK, this.on_战斗开始按钮_click, this);

    }

    on_第一次注入牌按钮_click() {
        this.第一次注入牌按钮.active = false;
        this.合成区域.active = true;
    }

    on_牌确认按钮_click() {

    }

    on_合成按钮_click() {

    }

    on_战斗开始按钮_click() {

    }

    on_随机按钮_click() {

    }



    update(deltaTime: number) {
        
    }
}


