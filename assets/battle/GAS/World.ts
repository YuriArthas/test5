import { create_unit, Unit } from "./Unit";
import { Node } from "cc";
export class World extends Unit {

}

export function create_world<T extends World>(WorldClassType: new ()=>T, node?: Node): T {
    const world = create_unit(WorldClassType, node);
    return world;
}
