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

class Pub {
  static instance = null;
  subs = {};

  constructor() {
    if (!Pub.instance) {
      Pub.instance = this;
    }
    return Pub.instance;
  }

  meteorSubscriptions = () => Meteor.getData().subscriptions;

  subscribe(name, params, componentId) {
    const subscriptions = this.meteorSubscriptions();
    const existing = findKey(subscriptions, {
      name,
      params: EJSON.clone(paramsForSub(params)),
    });
    const subscription = existing
      ? {
          ...subscriptions[existing],
          ready: () => subscriptions[existing].ready,
          stop: subscriptions[existing].stop,
          existing: true,
        }
      : Meteor.subscribe(name, ...paramsForSub(params));

    if (componentId) {
      const subId = subscription.id || subscription.subscriptionId;
      this.subs[subId] = uniq([...(this.subs[subId] || []), componentId]);
    }
    return subscription;
  }

  stop(subscription, componentId) {
    if (!subscription.name) {
      return;
    }
    const subId = subscription.id || subscription.subscriptionId;
    this.subs[subId] = this.subs[subId].filter((el) => el !== componentId);
    if (this.subs[subId].length === 0) {
      delete this.subs[subId];
      subscription.stop();
    }
  }
}

export default new Pub();