/**
 * @author Piotr Falba
 * @author Wei Zhuo
 * @author Jakub Kania
 * @author Nyby
 */

import { useEffect, useState } from 'react';

import Meteor from '../Meteor';
import { isObject } from 'lodash';

function depsFromValuesOf(params) {
  if (isObject(params)) {
    return Object.values(params);
  }
  if (Array.isArray(params)) {
    return params;
  }
  return typeof params === 'undefined' ? [] : [params];
}

export default (name, args = {}, dependencies) => {
  const deps = dependencies || [Meteor.userId(), ...depsFromValuesOf(args)];
  const [state, setState] = useState({ result: null, loading: true });
  const allArgsSet = !Object.values(args).some((x) => x === undefined);
  useEffect(() => {
    let mounted = true;
    if (!allArgsSet) {
      setState({ result: null, loading: false });
    } else {
      Meteor.call(name, args, (err, result) => {
        if (err) {
          console.log(err);
        }
        if (mounted) {
          setState({ err, result, loading: false });
        }
      });
      setState({ loading: true });
    }

    return () => {
      mounted = false;
    };
  }, deps);
  return state;
};
