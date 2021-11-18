interface selfConfig extends WorkerGlobalScope {
  require(s: string[], callback: Function): void;
  require(s: string): any;
}

declare var self: selfConfig;

export default self;

export const desmosRequire = self.require;
