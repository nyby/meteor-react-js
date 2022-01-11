export type IMeteorError = {
  error: number;
  errorType: string;
  isClientSafe: boolean;
  message: string;
  reason: string;
};

export type IUsePublication = {
  name: string;
  params?: Record<string, any>;
  userId?: string;
  fetch?: () => any;
};

export interface ICursor<T> {
  count(): number;
  fetch(): T[] | undefined;
  forEach(callback: (doc: T) => T): T[];
  map(callback: (doc: T) => T): T[];
}

export interface ICollection {
  find<T>(selector: any, options?: any): ICursor<T> | undefined;
  findOne<T>(selector: any, options?: any): T | undefined;
  insert(item: any, callback?: () => any): string;
  update(selector: any, modifier: any, options?: any, callback?: () => any): void;
  remove(selector: any, callback?: () => any): void;
}

export interface IData {
  getUrl(): string;
  waitDdpReady(cb: (...args: any[]) => void): void;
  onChange(cb: (...args: any[]) => void): void;
  offChange(cb: (...args: any[]) => void): void;
  on(eventName: string, cb: (...args: any[]) => void): void;
  off(eventName: string, cb: (...args: any[]) => void): void;
  waitDdpConnected(cb: (...args: any[]) => void): void;
}

export type Status = 'change' | 'connected' | 'disconnected' | 'loggingIn';

export declare const Meteor: {
  usePublication<T>(publication: IUsePublication, dependencies?: any[]): [T, boolean, boolean];
  useMethod<T>(
    name: string,
    args?: Record<string, any>,
    deps?: any[]
  ): { result: T; loading: boolean; err?: IMeteorError };
  call<T>(name: string, ...args: any[]): T;
  subscribe(name: string, ...args: any[]): { stop(): void; ready(): boolean };
  withTracker(options: Record<string, any>): any;
  useTracker(trackerFn: () => any, deps?: any[]): any;

  Mongo: {
    Collection: {
      new (collection: string): ICollection;
    };
  };
  Random: {
    id(count?: number): string;
  };
  Accounts: {
    onLogin(callback: () => any): void;
  };
  Tracker: any;

  getData(): IData;
  connect(endpoint: string, options?: any): void;
  disconnect(): void;
  reconnect(): void;
  status(): { connected: boolean; status: Status };

  userId(): string | undefined;
  user(): any | undefined;
  _handleLoginCallback(err: any, data: any): void;
  loggingIn(): boolean;
  logout(callback?: (err: any) => void): void;
};

export default Meteor;
