/**
 * @author Piotr Falba
 * @author Wei Zhuo
 * @author Jakub Kania
 * @author Nyby
 */

import { isObject } from 'lodash';
import { useEffect, useRef } from 'react';
import Random from '../../lib/Random';
import Pub from '../../lib/Pub';
import useTracker from './useTracker';
import Meteor from '../Meteor';
import EJSON from 'ejson';

function depsFromValuesOf(params) {
  if (isObject(params)) {
    return Object.values(params);
  }
  if (Array.isArray(params)) {
    return params;
  }
  return typeof params === 'undefined' ? [] : [ params ];
}

function info(msg) {
  console.info(`usePub: ${msg}`);
}

function subId(name, deps, refId) {
  return EJSON.stringify({ name, deps, refId });
}

export default function({ name, params = {}, userId, fetch = () => null }, dependencies) {
  const allArgsSet = !Object.values(params).some(x => x === undefined);
  const deps = dependencies || [ userId ?? Meteor.userId(), ...depsFromValuesOf(params) ];
  const ref = useRef(null);
  if (ref.current === null && allArgsSet) {
    ref.current = { subs: {}, id: Random.id() };
    if (Meteor.isVerbose()) {
      const p = JSON.stringify(params);
      const d = JSON.stringify(deps);
      info(`New ref ${name}(${p})${d}, refId=${ref.current.id}`);
    }
  }

  // stop publications on unmount
  useEffect(
    () => () => {
      const id = subId(name, deps, ref.current.id);
      if (ref.current.subs[id]) {
        if (Meteor.isVerbose()) {
          info(`Unmounting ${ref.current.id}, unsub ${id}`);
        }
        Pub.stop(ref.current.subs[id], ref.current.id);
        delete ref.current.subs[id];
      }
    },
    deps
  );

  return useTracker(() => {
    if (!allArgsSet) {
      return [ undefined, false, false ];
    }
    const id = subId(name, deps, ref.current.id);
    const sub = ref.current?.subs[id] ?? Pub.subscribe(name, params, ref.current.id);
    if (!ref.current?.subs[id]) {
      ref.current.subs[id] = sub;
    }
    const result = fetch();
    if (Meteor.isVerbose()) {
      const p = JSON.stringify(params);
      const d = JSON.stringify(deps);
      const r = sub.ready();
      info(`Ready=${r} ${name}(${p})${d}, refId=${ref.current.id}`);
    }
    const isLoading = !sub.ready() && !result;
    const notFound = sub.ready() && !result;
    return [ result, isLoading, notFound ];
  }, deps);
}
