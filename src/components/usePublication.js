/////////////////////////////////////////
// Authors: Piotr Falba, Wei Zhuo @ Nyby
/////////////////////////////////////////

import { isObject } from 'lodash';
import { useEffect, useRef } from 'react';
import Random from '../../lib/Random';
import Pub from '../../lib/Pub';

import useTracker from './useTracker';

const depsFromValuesOf = (params) => {
  if (isObject(params)) {
    return Object.keys(params || {}).length > 0
      ? Object.values(params)
      : undefined;
  }

  if (Array.isArray(params)) {
    return params;
  }

  return typeof params === 'undefined' ? undefined : [params];
};

export default ({ name, params, fetch = () => null }, deps) => {
  const componentId = Random.id();
  let subscription = useRef().current;
  useEffect(() => () => Pub.stop(subscription, componentId), []);

  return useTracker(() => {
    subscription = Pub.subscribe(name, params, componentId);
    const result = fetch();

    return [result, !subscription.ready() && !result];
  }, deps || depsFromValuesOf(params));
};
