import { Component, Prefab, director, _decorator } from "cc";
const { ccclass, property } = _decorator;
import resourceManager from "./battle/ResourceManager";
import { 静态配置 } from "./静态配置";

@ccclass("Loading")
export class Loading extends Component {
    async load(): Promise<void> {
    
        const 静态 = 静态配置.instance;
        const 牌数据Map = 静态.牌数据Map;
        const wait_list = Array.from(牌数据Map.values()).map(card => card.prefab);
        wait_list.push(静态.合成槽位prefab_path); // 合成槽位占位

        静态.单位数据Map.forEach(unit => {
            if(unit.prefab){
                wait_list.push(unit.prefab);
            }
        });

        await resourceManager.loadAll<Prefab>(wait_list);
        
        // 切换到战斗场景 
        director.loadScene("battle/battle");
    }

    onLoad(): void {
        this.load();
    }
}