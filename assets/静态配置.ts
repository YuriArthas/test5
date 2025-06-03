import { Component, assert } from "cc";
import { 牌数据 } from "./battle/牌数据";
import { 牌, 牌目标 } from "./battle/牌";

export enum 牌名字 {
    // 攻击
    拳头 = "拳头",
    脚踢 = "脚踢",
    剑劈 = "剑劈",
    击打 = "击打",
    魔法弹 = "魔法弹",

    // 辅助
    防守 = "防守",
    
    闪避 = "闪避",
    吼叫 = "吼叫",
    祈祷 = "祈祷",
    治疗 = "治疗",

    // 元素
    火焰 = "火焰",
    水流 = "水流",
    闪电 = "闪电",
    毒素 = "毒素",

    // 增幅
    加倍 = "加倍",
    暴击 = "暴击",
    幸运 = "幸运",
    扩散 = "扩散",
    持续 = "持续",

    // 特殊
    炸弹 = "炸弹",
    绷带 = "绷带",
    奖励骰子 = "奖励骰子",
    水晶骰子 = "水晶骰子",

    // 攻击(组合2)
    二连击 = "二连击",
    二连踢 = "二连踢",
    拳打脚踢 = "拳打脚踢",
    天打雷劈 = "天打雷劈",
    严防死守 = "严防死守",
    恰恰舞 = "恰恰舞",
    嘲讽 = "嘲讽",
    战争怒吼 = "战争怒吼",
    虔诚祈祷 = "虔诚祈祷",
    祝福 = "祝福",
    嗜血 = "嗜血",
    二连劈 = "二连劈",
    二连打 = "二连打",
    大力击打 = "大力击打",
    火拳 = "火拳",
    老寒腿 = "老寒腿",
    醉拳 = "醉拳",
    华山剑法 = "华山剑法",
    少林棍阵 = "少林棍阵",
    武当长拳 = "武当长拳",
    扫堂腿 = "扫堂腿",

    魔法连射 = "魔法连射",
    魔法拳击 = "魔法拳击",
    火球术 = "火球术",
    冻结术 = "冻结术",
    电击术 = "电击术",
    毒魔法 = "毒魔法",
    治疗魔法 = "治疗魔法",
    诅咒魔法 = "诅咒魔法",
    手捧雷 = "手捧雷",
    射门 = "射门",
    包扎 = "包扎",
    足疗 = "足疗",
}

export enum 牌类型 {
    攻击 = "攻击",
    辅助 = "辅助",
    增幅 = "增幅",
    元素 = "元素",
    特殊 = "特殊",
}

type 牌初始化配置 = {
    name: 牌名字;
    合成材料: 牌名字[];
    面prefab?: string;
    component?: new () => 牌;
    战斗prefab?: string;
    num?: {
        min: number;
        max: number;
    }
    aim?: 牌目标;

    type: 牌类型;
}


export class 静态配置 {
    牌数据Map: Map<string, 牌数据> = new Map();
    骰子个数基础最小值: number = 4;
    骰子个数基础最大值: number = 8;
    通用牌prefab_path: string = '6ca0aa92-bd00-4939-b276-3acbd1bc7513';
    合成槽位prefab_path: string = 'b0d4e98f-c7b3-4c82-aeda-6ca24dbdb4e5';
    private static _instance: 静态配置;
    public static get instance(): 静态配置 {
        if (!this._instance) {
            this._instance = new 静态配置();
        }
        return this._instance;
    }

    constructor() {
        // 创建所有牌
        this.add_card({name: 牌名字.拳头, 合成材料: [], type: 牌类型.攻击});
        this.add_card({name: 牌名字.剑劈, 合成材料: [], type: 牌类型.攻击});
        this.add_card({name: 牌名字.击打, 合成材料: [], type: 牌类型.攻击});
        this.add_card({name: 牌名字.魔法弹, 合成材料: [], type: 牌类型.攻击});
        this.add_card({name: 牌名字.加倍, 合成材料: [], type: 牌类型.增幅});
        this.add_card({name: 牌名字.暴击, 合成材料: [], type: 牌类型.增幅});
        this.add_card({name: 牌名字.幸运, 合成材料: [], type: 牌类型.增幅});
        this.add_card({name: 牌名字.扩散, 合成材料: [], type: 牌类型.增幅});
        this.add_card({name: 牌名字.持续, 合成材料: [], type: 牌类型.增幅});
        this.add_card({name: 牌名字.炸弹, 合成材料: [], type: 牌类型.特殊});
        this.add_card({name: 牌名字.绷带, 合成材料: [], type: 牌类型.特殊});
        this.add_card({name: 牌名字.奖励骰子, 合成材料: [], type: 牌类型.特殊});
        this.add_card({name: 牌名字.水晶骰子, 合成材料: [], type: 牌类型.特殊});



        this.处理牌子引用();
    }

    private add_card(config: 牌初始化配置) {
        // 创建新的牌数据
        const card = new 牌数据();
        card.name = config.name;
        card.合成材料 = [];
        card.prefab = config.面prefab?? this.通用牌prefab_path;
        card.牌class = config.component?? 牌;
        card.num = config.num;
        card.aim = config.aim?? 牌目标.敌方1;
        // 先将牌添加到Map中，以便后续引用
        this.牌数据Map.set(config.name, card);
        
        // 设置子牌引用（延迟处理，在所有牌创建后再设置）
        (card as any)._pending_sub_cards = config.合成材料;
    }

    private 处理牌子引用() {
        for (const [name, card] of this.牌数据Map.entries()) {
            const pending_sub_cards = (card as any)._pending_sub_cards as string[];
            if (pending_sub_cards) {
                for (const sub_name of pending_sub_cards) {
                    const sub_card = this.牌数据Map.get(sub_name);
                    if (sub_card) {
                        card.合成材料.push(sub_card);
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
            if (card && card.合成材料) {
                for (const sub_card of card.合成材料) {
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