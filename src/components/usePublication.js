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

function depsFromValuesOf(params) {
  if (isObject(params)) {
    return Object.values(params);
  }
  if (Array.isArray(params)) {
    return params;
  }
  return typeof params === 'undefined' ? [] : [params];
}

export default function({ name, params = {}, userId, fetch = () => null }, dependencies) {
  const allArgsSet = !Object.values(params).some(x => x === undefined);
  const deps = dependencies || [userId ?? Meteor.userId(), ...depsFromValuesOf(params)];
  const ref = useRef(null);
  if (ref.current === null && allArgsSet) {
    ref.current = { sub: null, id: Random.id() };
    if (Meteor.isVerbose) {
      const p = JSON.stringify(params);
      const d = JSON.stringify(deps);
      console.info(`Use: new ref ${name}(${p})${d}, refId=${ref.current.id}`);
    }
  }

  // stop publications on unmount
  useEffect(() => () => ref.current?.sub && Pub.stop(ref.current.sub, ref.current.id), deps);

  return useTracker(() => {
    if (!allArgsSet) {
      return [undefined, false, false];
    } else {
      if (ref.current.sub === null) {
        ref.current.sub = Pub.subscribe(name, params, ref.current.id);
      }
      const result = fetch();
      if (Meteor.isVerbose) {
        const p = JSON.stringify(params);
        const d = JSON.stringify(deps);
        const r = ref.current.sub.ready();
        console.info(`Use: ready=${r} ${name}(${p})${d}, refId=${ref.current.id}`);
      }
      const isLoading = !ref.current.sub.ready() && !result;
      const notFound = ref.current.sub.ready() && !result;
      return [result, isLoading, notFound];
    }
  }, deps);
}
