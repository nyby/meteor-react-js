/////////////////////////////////////////
// Authors: Piotr Falba, Wei Zhuo @ Nyby
/////////////////////////////////////////

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

class Pub {
  subs = {};

  subscribe(name, params, refId) {
    let id = findExistingSubscriptionId(name, params);
    if (!id || !this.subs[id]) {
      const subscription = Meteor.subscribe(name, ...paramsForSub(params));
      id = subscription.subscriptionId;
      this.subs[id] = { subscription, refs: [] };
    }
    this.subs[id].refs = uniq([...this.subs[id].refs, refId]);
    return this.subs[id].subscription;
  }

  stop(subscription, refId) {
    const id = subscription.subscriptionId;
    if (!id || !this.subs[id]) {
      return;
    }
    this.subs[id].refs = this.subs[id].refs.filter((i) => i !== refId);
    if (this.subs[id].refs.length === 0) {
      delete this.subs[id];
      subscription.stop();
    }
  }
}

export default new Pub();
