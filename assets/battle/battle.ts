import { _decorator, assert, assetManager, Button, CCInteger, Component, instantiate, Node, Prefab, UITransform, Vec3 } from 'cc';
import { 局数据 } from './存档';
import { 属性管理器 } from './属性管理器';
import { 属性 } from './属性';
import { 牌名字, 静态配置 } from '../静态配置';
import resourceManager from './ResourceManager';
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
    public 合成槽位0: Node = null;

    @property(Node)
    public 合成槽位1: Node = null;

    @property(Node)
    public 合成槽位2: Node = null;

    @property(Node)
    public 战斗开始按钮: Node = null;

    @property(Node)
    public 第一次注入牌按钮: Node = null;

    @property(属性管理器)
    public 属性管理器: 属性管理器 = null;

    @property(CCInteger)
    public 随机数种子: number = 0;

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
        console.log("loadAll finished");
    }
    
    start() {
        if (!this.局数据){
            this.initBattle(this.生成局数据());
        }

        if(this.随机数种子 == 0){
            this.随机数种子 = Math.floor(Math.random() * 1000000);
        }



        this.合成区域.active = false;

        this.第一次注入牌按钮.on(Button.EventType.CLICK, this.on_第一次注入牌按钮_click, this);
        this.随机按钮.on(Button.EventType.CLICK, this.on_随机按钮_click, this);
        this.牌确认按钮.on(Button.EventType.CLICK, this.on_牌确认按钮_click, this);
        this.合成按钮.on(Button.EventType.CLICK, this.on_合成按钮_click, this);
        this.战斗开始按钮.on(Button.EventType.CLICK, this.on_战斗开始按钮_click, this);

        this.属性管理器.属性Map.set("骰子最小数量", new 属性(this.属性管理器, 静态配置.instance.骰子个数基础最小值));
        this.属性管理器.属性Map.set("骰子最大数量", new 属性(this.属性管理器, 静态配置.instance.骰子个数基础最大值));
    }

    async on_第一次注入牌按钮_click() {
        this.第一次注入牌按钮.active = false;
        this.合成区域.active = true;

        const count = this.random_int(this.属性管理器.get_attr("骰子最小数量").value, this.属性管理器.get_attr("骰子最大数量").value + 1);
        const card_size = this.合成结果显示面板.getComponent(UITransform).contentSize;
        const region_size = this.牌物品栏.getComponent(UITransform).contentSize;
        assert(region_size.width % card_size.width == 0, "牌物品栏宽度不是牌的整数倍");

        const col_count = region_size.width / card_size.width;
        for(let i = 0; i < count; i++){
            const 拳头牌数据 = 静态配置.instance.牌数据Map.get(牌名字.拳头);
            const card = 拳头牌数据.create_card();
            this.牌物品栏.addChild(card);
            const x = ((i % col_count) + 0.5) * card_size.width;
            const y = (Math.floor(i / col_count) + 0.5) * card_size.height;
            card.setPosition(new Vec3(x, y, 0));
        }
        
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

    private random(): number {
        this.随机数种子 = (1103515245 * this.随机数种子 + 12345) & 0x7fffffff;
        return this.随机数种子;
    }

    private random_int(a: number, b: number): number {
        return Math.floor(this.random() / 0x7fffffff * (b - a)) + a;
    }
}


