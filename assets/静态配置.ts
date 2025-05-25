import { 牌数据 } from "./battle/牌数据";

export enum 牌名字 {
    拳头 = "拳头",
    剑 = "剑",
    超级剑 = "超级剑",
    木法杖 = "木法杖",
    火 = "火",
    火法杖 = "火法杖",
}

export enum 牌类型 {
    攻击牌 = "攻击牌",
    辅助牌 = "辅助牌",
    增幅牌 = "增幅牌",
}

type 牌初始化配置 = {
    name: 牌名字;
    sub_card: 牌名字[];
    prefab?: string;
    type: 牌类型;
}

export class 静态配置 {
    牌数据Map: Map<string, 牌数据> = new Map();
    骰子个数基础最小值: number = 4;
    骰子个数基础最大值: number = 8;
    static 通用牌prefab_path: string = '6ca0aa92-bd00-4939-b276-3acbd1bc7513';

    private static _instance: 静态配置;
    public static get instance(): 静态配置 {
        if (!this._instance) {
            this._instance = new 静态配置();
        }
        return this._instance;
    }

    constructor() {
        // 创建所有牌
        this.add_card({name: 牌名字.拳头, sub_card: [], prefab: "7ffb1903-ee15-4360-9cb3-6ed7327aa9c6", type: 牌类型.攻击牌});
        this.add_card({name: 牌名字.剑, sub_card: [], prefab: "cf6ce125-3db4-435c-8fd4-2eaeac07fb8b", type: 牌类型.攻击牌});
        this.add_card({name: 牌名字.超级剑, sub_card: [牌名字.拳头, 牌名字.剑], prefab: "ecf4b454-695c-44f1-b50a-966d96be27cf", type: 牌类型.攻击牌});
        this.add_card({name: 牌名字.木法杖, sub_card: [], type: 牌类型.攻击牌});
        this.add_card({name: 牌名字.火, sub_card: [], type: 牌类型.增幅牌});
        this.add_card({name: 牌名字.火法杖, sub_card: [牌名字.火, 牌名字.木法杖], type: 牌类型.攻击牌});
        

        this.处理牌子引用();
    }

    private add_card(config: 牌初始化配置) {
        // 创建新的牌数据
        const card = new 牌数据();
        card.name = config.name;
        card.sub_card = [];
        card.prefab = config.prefab?? 静态配置.通用牌prefab_path;
        // 先将牌添加到Map中，以便后续引用
        this.牌数据Map.set(config.name, card);
        
        // 设置子牌引用（延迟处理，在所有牌创建后再设置）
        (card as any)._pending_sub_cards = config.sub_card;
    }

    private 处理牌子引用() {
        for (const [name, card] of this.牌数据Map.entries()) {
            const pending_sub_cards = (card as any)._pending_sub_cards as string[];
            if (pending_sub_cards) {
                for (const sub_name of pending_sub_cards) {
                    const sub_card = this.牌数据Map.get(sub_name);
                    if (sub_card) {
                        card.sub_card.push(sub_card);
                    } else {
                        console.error(`找不到子牌: ${sub_name}`);
                    }
                }
                // 清理临时属性
                delete (card as any)._pending_sub_cards;
            }
        }

        this.验证环形依赖();
    }

    private 验证环形依赖(): void {
        const visited = new Set<string>();
        const recursion_stack = new Set<string>();

        const has_cycle = (card_name: string): boolean => {
            if (recursion_stack.has(card_name)) {
                console.error(`检测到环形依赖: ${card_name}`);
                return true;
            }

            if (visited.has(card_name)) {
                return false;
            }

            visited.add(card_name);
            recursion_stack.add(card_name);

            const card = this.牌数据Map.get(card_name);
            if (card && card.sub_card) {
                for (const sub_card of card.sub_card) {
                    if (has_cycle(sub_card.name)) {
                        return true;
                    }
                }
            }

            recursion_stack.delete(card_name);
            return false;
        };

        let has_any_cycle = false;
        for (const card_name of this.牌数据Map.keys()) {
            if (!visited.has(card_name)) {
                if (has_cycle(card_name)) {
                    has_any_cycle = true;
                }
            }
        }

        if (has_any_cycle) {
            console.error("存在环形依赖！");
        } else {
            console.log("没有检测到环形依赖，配置正确。");
        }
    }
}