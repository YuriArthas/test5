import { _decorator, Component } from "cc";
import { 属性 } from "./属性";
import { 属性静态注册器 } from "./属性";
import { I属性管理器 } from "./I属性管理器";
const { ccclass, property } = _decorator;

@ccclass('属性管理器')
export class 属性管理器 extends Component implements I属性管理器{
    属性Map: Map<string, 属性> = new Map();

    get_attr(name: string, create_if_not_exist: boolean = false): 属性 {
        let attr = this.属性Map.get(name);
        if(attr == undefined) {
            if(create_if_not_exist){
                attr = 属性静态注册器.创建(name, this);
                this.属性Map.set(name, attr);
            }
        }
        
        return attr;
    }
}