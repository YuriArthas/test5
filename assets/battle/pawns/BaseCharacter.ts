import { Pawn, PawnInitData } from "../GAS/Unit";
import { 单位数据 } from "../../静态配置";
import { Attribute } from "../GAS/属性";


export interface BaseCharacterInitData extends PawnInitData {
    unit_data: 单位数据;
}

export class BaseCharacter extends Pawn {
    static InitDataType: new ()=> BaseCharacterInitData = undefined;

    unit_data: 单位数据 = undefined;

    init(init_data: BaseCharacterInitData) {
        super.init(init_data);

        this.unit_data = init_data.unit_data;

        const 最大生命 = this.asc.get_attribute("最大生命") as any as Attribute;
        const 生命 = this.asc.get_attribute("生命") as any as Attribute;
        生命.max_attr = 最大生命;
        
        const 最大魔法 = this.asc.get_attribute("最大魔法") as any as Attribute;
        const 魔法 = this.asc.get_attribute("魔法") as any as Attribute;
        魔法.max_attr = 最大魔法;
        

        for(let elem of this.unit_data.attr_list){
            const attr = this.asc.get_attribute(elem.name) as any as Attribute;
            if(elem.value instanceof Array){
                attr.base_value = elem.value[0];
                attr.base_add_mul = elem.value[1];
                attr.base_mul_mul = elem.value[2];
            }else{
                attr.base_value = elem.value;
            }
        }

        for(let elem of this.unit_data.ability_list){
            this.asc.add_ability(elem);
        }
    }
}