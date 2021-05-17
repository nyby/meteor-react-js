import { useRef } from 'react';
import { isObject } from 'lodash';

import Meteor from '../Meteor';
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

const paramsForSub = (params) => {
  if (Array.isArray(params)) {
    return params;
  }
  return typeof params === 'undefined' ? [] : [params];
};

const checkIfDepsEmpty = (deps) => {
  const params = depsFromValuesOf(deps) ? depsFromValuesOf(deps) : [];
  return Boolean(params.filter((p) => p === '').length);
};

export default ({ name, params, fetch = () => null }, deps = null) => {
  let subscription = useRef().current;
  return useTracker(() => {
    const p = paramsForSub(params);
    if (checkIfDepsEmpty(p)) {
      return [[], false];
    }
    subscription = Meteor.subscribe(name, ...p);
    const result = fetch();
    return [result, !subscription.ready() && !result];
  }, deps || depsFromValuesOf(params));
};
