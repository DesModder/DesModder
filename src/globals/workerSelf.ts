interface selfConfig extends WorkerGlobalScope {
  require: ((s: string[], callback: Function) => void) & ((s: string) => any);
}

declare let self: selfConfig;

export default self;

export const desmosRequire = self.require;
