import { _decorator, Button, Component, Sprite, Prefab, instantiate, Node, Label } from "cc";
import { 静态配置 } from "../静态配置";
import resourceManager from "../battle/ResourceManager";
import { 牌 } from "../battle/牌";

const { ccclass, property } = _decorator;

 





export class 牌数据 {
    name: string;
    sub_card: 牌数据[];
    prefab?: string;

    static equal(a: 牌数据, b: 牌数据): boolean {
        return a.name === b.name;
    } 

    static 尝试合成(list: 牌数据[]): 牌数据 {
        if (list.length === 0) {
            return undefined;
        }
        
        // 获取静态配置实例来访问所有牌数据
        const config = 静态配置.instance;
        
        // 遍历所有牌，检查是否有牌的sub_card与list匹配
        for (const [name, card] of config.牌数据Map.entries()) {
            if (this.牌数组相等(list, card.sub_card)) {
                return card;
            }
        }
        
        return undefined;
    }
    
    // 辅助方法：检查两个牌数组是否相等（不考虑顺序）
    private static 牌数组相等(list1: 牌数据[], list2: 牌数据[]): boolean {
        if (list1.length !== list2.length) {
            return false;
        }
        
        // 创建计数映射
        const count1 = new Map<string, number>();
        const count2 = new Map<string, number>();
        
        // 统计list1中每种牌的数量
        for (const card of list1) {
            count1.set(card.name, (count1.get(card.name) || 0) + 1);
        }
        
        // 统计list2中每种牌的数量
        for (const card of list2) {
            count2.set(card.name, (count2.get(card.name) || 0) + 1);
        }
        
        // 比较两个计数映射
        if (count1.size !== count2.size) {
            return false;
        }
        
        for (const [name, count] of count1.entries()) {
            if (count2.get(name) !== count) {
                return false;
            }
        }
        
        return true;
    }

    create_card(): Node {
        let prefab_path = this.prefab;
        const prefab = resourceManager.get_assets<Prefab>(prefab_path);
        const card = instantiate(prefab);
        const 牌组件 = card.addComponent(牌);
        牌组件.牌数据 = this;
        if(prefab_path == 静态配置.通用牌prefab_path) {  // 通用牌
            const LabelNode = card.getChildByName("Label");
            if(LabelNode){
                const label = LabelNode.getComponent(Label);
                if(label){
                    label.string = this.name;
                }
            }
        }
        return card;
    }
}