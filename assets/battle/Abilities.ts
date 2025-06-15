import { AbilitySpec } from "./GAS/AbilitySpec";
import { ASC } from "./GAS/AbilitySystemComponent";
import { World } from "./GAS/World";

export class 拳打Spec extends AbilitySpec {
    constructor(world: World, gas_id: number) {
        super(world, gas_id);
    }
}

export class 脚踢Spec extends AbilitySpec {
    constructor(world: World, gas_id: number) {
        super(world, gas_id);
    }
}