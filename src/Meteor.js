import Tracker from './Tracker';
import EJSON from 'ejson';
import DDP from './lib/ddp.js';
import Random from './lib/Random';

import Data from './Data';
import Mongo from './Mongo';
import { Collection, localCollections, runObservers } from './Collection';
import call from './Call';

import withTracker from './components/withTracker';
import useTracker from './components/useTracker';
import usePublication from './components/usePublication';
import useMethod from './components/useMethod';
import Accounts from './user/Accounts.js';
import ReactiveDict from './ReactiveDict';

let isVerbose = false;

function debugSub(name, params) {
  const args = JSON.stringify(params).replace(/^\[|\]$/g, '');
  return `"${name}"(${args})`;
}

function info(msg) {
  console.info(`DDP: ${msg}`);
}

const Meteor = {
  isVerbose() {
    return isVerbose;
  },
  enableVerbose() {
    isVerbose = true;
  },
  Random,
  Mongo,
  Tracker,
  EJSON,
  ReactiveDict,
  Accounts,
  Collection,
  withTracker,
  useTracker,
  usePublication,
  useMethod,
  getData() {
    return Data;
  },
  status() {
    return {
      connected: Data.ddp ? Data.ddp.status === 'connected' : false,
      status: Data.ddp ? Data.ddp.status : 'disconnected',
      // retryCount: 0
      // retryTime:
      // reason:
    };
  },
  call,
  disconnect() {
    if (Data.ddp) {
      Data.ddp.disconnect();
    }
  },
  _subscriptionsRestart() {
    for (const i of Object.keys(Data.subscriptions)) {
      const sub = Data.subscriptions[i];
      Data.ddp.unsub(sub.subIdRemember);
      sub.subIdRemember = Data.ddp.sub(sub.name, sub.params);
    }
  },
  waitDdpConnected: Data.waitDdpConnected.bind(Data),
  reconnect() {
    Data.ddp && Data.ddp.connect();
  },
  packageInterface: () => {
    return {
      localStorage,
    };
  },
  connect(endpoint, options) {
    if (!endpoint) {
      endpoint = Data._endpoint;
    }
    if (!options) {
      options = Data._options;
    }

    if ((!endpoint.startsWith('ws') || !endpoint.endsWith('/websocket')) && !options.suppressUrlErrors) {
      throw new Error(
        // eslint-disable-next-line max-len
        `Your url "${endpoint}" may be in the wrong format. It should start with "ws://" or "wss://" and end with "/websocket", e.g. "wss://myapp.meteor.com/websocket". To disable this warning, connect with option "suppressUrlErrors" as true, e.g. Meteor.connect("${endpoint}", {suppressUrlErrors:true});`
      );
    }

    Data._endpoint = endpoint;
    Data._options = options;

    this.ddp = Data.ddp = new DDP({
      endpoint,
      SocketConstructor: WebSocket,
      ...options,
    });

    Data.ddp.on('connected', () => {
      // Clear the collections of any stale data in case this is a reconnect
      if (Data.db && Data.db.collections) {
        for (const collection of Object.keys(Data.db.collections)) {
          if (!localCollections.includes(collection)) {
            // Dont clear data from local collections
            Data.db[collection].remove({});
          }
        }
      }

      Data.notify('change');

      if (isVerbose) {
        info(`Connected to DDP server ${endpoint}`);
      }
      this._loadInitialUser().then(() => {
        this._subscriptionsRestart();
      });
    });

    let lastDisconnect = null;
    Data.ddp.on('disconnected', () => {
      Data.notify('change');

      if (isVerbose) {
        info('Disconnected from DDP server.');
      }

      if (!Data.ddp.autoReconnect) {
        return;
      }

      if (!lastDisconnect || new Date() - lastDisconnect > 3000) {
        Data.ddp.connect();
      }

      lastDisconnect = new Date();
    });

    Data.ddp.on('added', (message) => {
      if (!Data.db[message.collection]) {
        Data.db.addCollection(message.collection);
      }
      const document = {
        _id: message.id,
        ...message.fields,
      };

      Data.db[message.collection].upsert(document);
      if (isVerbose) {
        info(`Added to "${message.collection}", _id=${message.id}`);
      }
      runObservers('added', message.collection, document);
    });

    Data.ddp.on('ready', (message) => {
      if (isVerbose) {
        info(`Ready subs=${message.subs}`);
      }
      const idsMap = new Map();
      for (const i of Object.keys(Data.subscriptions)) {
        const sub = Data.subscriptions[i];
        idsMap.set(sub.subIdRemember, sub.id);
      }
      for (const i of Object.keys(message.subs)) {
        const subId = idsMap.get(message.subs[i]);
        if (subId) {
          if (isVerbose) {
            info(`Subscription ready subId=${subId}`);
          }
          const sub = Data.subscriptions[subId];
          sub.ready = true;
          sub.readyDeps.changed();
          sub.readyCallback && sub.readyCallback();
        }
      }
    });

    Data.ddp.on('changed', (message) => {
      const unset = {};
      if (isVerbose) {
        info(`Changed to "${message.collection}", _id=${message.id}`);
      }
      if (message.cleared) {
        message.cleared.forEach((field) => {
          unset[field] = null;
        });
      }

      if (Data.db[message.collection]) {
        const document = {
          _id: message.id,
          ...message.fields,
          ...unset,
        };

        const oldDocument = Data.db[message.collection].findOne({
          _id: message.id,
        });

        Data.db[message.collection].upsert(document);

        runObservers('changed', message.collection, document, oldDocument);
      }
    });

    Data.ddp.on('removed', (message) => {
      if (isVerbose) {
        info(`Removed from "${message.collection}", _id=${message.id}`);
      }
      if (Data.db[message.collection]) {
        const oldDocument = Data.db[message.collection].findOne({
          _id: message.id,
        });
        Data.db[message.collection].del(message.id);
        runObservers('removed', message.collection, oldDocument);
      }
    });

    Data.ddp.on('result', (message) => {
      const c = Data.calls.find((x) => x.id === message.id);
      if (isVerbose) {
        info(`Method result for id=${message.id}`);
      }
      if (typeof c.callback === 'function') {
        c.callback(message.error, message.result);
      }
      Data.calls.splice(
        Data.calls.findIndex((x) => x.id === message.id),
        1
      );
    });

    Data.ddp.on('nosub', (message) => {
      for (const i of Object.keys(Data.subscriptions)) {
        const sub = Data.subscriptions[i];
        if (sub.subIdRemember === message.id) {
          console.warn('DDP: No subscription existing for', sub.name);
        }
      }
    });
  },
  subscribe(name) {
    const params = Array.prototype.slice.call(arguments, 1);
    let callbacks = {};
    if (params.length) {
      let lastParam = params[params.length - 1];
      if (typeof lastParam === 'function') {
        callbacks.onReady = params.pop();
      } else if (
        lastParam &&
        (typeof lastParam.onReady === 'function' ||
          typeof lastParam.onError === 'function' ||
          typeof lastParam.onStop === 'function')
      ) {
        callbacks = params.pop();
      }
    }

    // Is there an existing sub with the same name and param, run in an
    // invalidated Computation? This will happen if we are rerunning an
    // existing computation.
    //
    // For example, consider a rerun of:
    //
    //     Tracker.autorun(function () {
    //       Meteor.subscribe("foo", Session.get("foo"));
    //       Meteor.subscribe("bar", Session.get("bar"));
    //     });
    //
    // If "foo" has changed but "bar" has not, we will match the "bar"
    // subscribe to an existing inactive subscription in order to not
    // unsub and resub the subscription unnecessarily.
    //
    // We only look for one such sub; if there are N apparently-identical subs
    // being invalidated, we will require N matching subscribe calls to keep
    // them all active.

    let existing = false;
    for (const i of Object.keys(Data.subscriptions)) {
      const sub = Data.subscriptions[i];
      if (sub.inactive && sub.name === name && EJSON.equals(sub.params, params)) {
        existing = sub;
      }
    }

    let id;
    if (existing) {
      id = existing.id;
      existing.inactive = false;

      if (callbacks.onReady) {
        // If the sub is not already ready, replace any ready callback with the
        // one provided now. (It's not really clear what users would expect for
        // an onReady callback inside an autorun; the semantics we provide is
        // that at the time the sub first becomes ready, we call the last
        // onReady callback provided, if any.)
        if (!existing.ready) {
          existing.readyCallback = callbacks.onReady;
        }
      }
      if (callbacks.onStop) {
        existing.stopCallback = callbacks.onStop;
      }
    } else {
      // New sub! Generate an id, save it locally, and send message.

      id = Random.id();
      const subIdRemember = Data.ddp.sub(name, params);
      if (isVerbose) {
        info(`Subscribe to ${debugSub(name, params)} subId=${id}, sub=${subIdRemember}`);
      }
      Data.subscriptions[id] = {
        id,
        subIdRemember,
        name,
        params: EJSON.clone(params),
        inactive: false,
        ready: false,
        readyDeps: new Tracker.Dependency(),
        readyCallback: callbacks.onReady,
        stopCallback: callbacks.onStop,
        stop() {
          Data.ddp.unsub(this.subIdRemember);
          delete Data.subscriptions[this.id];
          this.ready && this.readyDeps.changed();
          if (isVerbose) {
            info(`Stopping ${debugSub(name, params)}  subId=${this.id}, sub=${this.subIdRemember}`);
          }
          if (callbacks.onStop) {
            callbacks.onStop();
          }
        },
      };
    }

    // return a handle to the application.
    const handle = {
      stop() {
        if (Data.subscriptions[id]) {
          Data.subscriptions[id].stop();
        }
      },
      ready() {
        if (!Data.subscriptions[id]) {
          return false;
        }
        const record = Data.subscriptions[id];
        record.readyDeps.depend();
        return record.ready;
      },
      subscriptionId: id,
    };

    /* if (Tracker.active) {
      // We're in a reactive computation, so we'd like to unsubscribe when the
      // computation is invalidated... but not if the rerun just re-subscribes
      // to the same subscription!  When a rerun happens, we use onInvalidate
      // as a change to mark the subscription "inactive" so that it can
      // be reused from the rerun.  If it isn't reused, it's killed from
      // an afterFlush.
      Tracker.onInvalidate(function () {
        if (isVerbose) {
          info(`Tracker.onInvalidate subId=${id}`);
        }
        if (Data.subscriptions[id] && Data.subscriptions[id].ready) {
          Data.subscriptions[id].inactive = true;
        }

        Tracker.afterFlush(function () {
          if (isVerbose) {
            info(`Tracker.afterFlush subId=${id}`);
          }
          if (Data.subscriptions[id] && Data.subscriptions[id].inactive) {
            handle.stop();
          }
        });
      });
    } */
    return handle;
  },
};

export default Meteor;
