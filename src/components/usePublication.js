/////////////////////////////////////////
// Authors: Piotr Falba, Wei Zhuo @ Nyby
/////////////////////////////////////////

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
  return [params];
}

export default function ({ name, params, fetch = () => null }, dependencies) {
  const deps = dependencies || [Meteor.userId(), ...depsFromValuesOf(params)];
  const ref = useRef(null);
  if (ref.current === null) {
    ref.current = { sub: null, id: Random.id() };
  }
  useEffect(() => () => Pub.stop(ref.current.sub, ref.current.id), deps);
  return useTracker(() => {
    ref.current.sub = Pub.subscribe(name, params, ref.current.id);
    const result = fetch();
    return [result, !ref.current.sub.ready() && !result];
  }, deps);
}
