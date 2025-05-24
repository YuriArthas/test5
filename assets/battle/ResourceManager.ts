import { assetManager, Asset } from "cc";

class ResourceManager {
    private static _instance: ResourceManager;
    public static get instance(): ResourceManager {
        if (!this._instance) {
            this._instance = new ResourceManager();
        }
        return this._instance;
    }

    cache: Map<string, Asset> = new Map();

    async load<T extends Asset>(path: string|{url: string}): Promise<T> {
        if (typeof path === 'string') {
            if (this.cache.has(path)) {
                return this.cache.get(path) as T;
            }
        } else {
            if (this.cache.has(path.url)) {
                return this.cache.get(path.url) as T;
            }
        }
        return new Promise<T>(async (resolve, reject) => {
            assetManager.loadAny(path, (err, asset) => {
                if (err) {
                    reject(err);
                } else {
                    if (typeof path === 'string') {
                        this.cache.set(path, asset);
                    } else {
                        this.cache.set(path.url, asset);
                    }
                    console.log("load finished", path);
                    resolve(asset as T);
                }
            });
        });
    }

    async loadAll<T extends Asset>(paths: (string|{url: string})[]): Promise<T[]> {
        const loadPromises = paths.map(path => this.load<T>(path));
        return Promise.all(loadPromises);
    }

    get_assets<T extends Asset>(path: string): T | null {
        if (this.cache.has(path)) {
            return this.cache.get(path) as T;
        }
        return null;
    }

    
}

const resourceManager = ResourceManager.instance;

export default resourceManager;
