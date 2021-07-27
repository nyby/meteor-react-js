/**
 * @author Piotr Falba
 * @author Wei Zhuo
 * @author Jakub Kania
 * @author Nyby
 */

import { findKey, uniq } from 'lodash';
import Meteor from '../src/Meteor';
import EJSON from 'ejson';

function paramsForSub(params) {
  if (Array.isArray(params)) {
    return params;
  }
  return typeof params === 'undefined' ? [] : [params];
}

function findExistingSubscriptionId(name, params) {
  return findKey(Meteor.getData().subscriptions, {
    name,
    params: EJSON.clone(paramsForSub(params)),
  });
}

function info(msg) {
  console.info(`Pub: ${msg}`);
}

class Pub {
  subs = {};

  _debugRefs(id) {
    if (this.subs[id]) {
      return `subId=${id}, refs(${this.subs[id].refs.length})=${this.subs[id].refs}`;
    }
    return 'not found';
  }

  subscribe(name, params, refId) {
    let id = findExistingSubscriptionId(name, params);
    if (!id || !this.subs[id]) {
      if (Meteor.isVerbose()) {
        const p = JSON.stringify(params);
        info(`New subscription ${name}(${p}), refId=${refId}`);
      }
      const subscription = Meteor.subscribe(name, ...paramsForSub(params));
      id = subscription.subscriptionId;
      this.subs[id] = { subscription, refs: [] };
    } else if (id) {
      if (Meteor.isVerbose()) {
        const p = JSON.stringify(params);
        info(`Existing subscription ${name}(${p}), subId=${id}, refId=${refId}`);
      }
    }
    this.subs[id].refs = uniq([...this.subs[id].refs, refId]);
    if (Meteor.isVerbose()) {
      info(`Subscribe ${this._debugRefs(id)}`);
    }
    return this.subs[id].subscription;
  }

  stop(subscription, refId) {
    const id = subscription.subscriptionId;
    if (!id || !this.subs[id]) {
      return;
    }
    this.subs[id].refs = this.subs[id].refs.filter((i) => i !== refId);
    if (Meteor.isVerbose()) {
      info(`Stop subscription ${this._debugRefs(id)}`);
    }
    if (this.subs[id].refs.length === 0) {
      if (Meteor.isVerbose()) {
        info(`Pub: Delete subscription subId=${id}`);
      }
      delete this.subs[id];
      subscription.stop();
    }
  }
}

export default new Pub();
