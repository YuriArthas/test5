import { create_unit, Unit } from "./Unit";
import { Node } from "cc";
import { 可被拖到Component } from "../可被拖到Component";
export class World extends Unit {
    dragable_layer_map: Map<number, 可被拖到Component[]> = new Map();
}

export function create_world<T extends World>(WorldClassType: new ()=>T, node?: Node): T {
    const world = create_unit(WorldClassType, node);
    return world;
}
