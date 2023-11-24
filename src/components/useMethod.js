/**
 * @author Piotr Falba
 * @author Wei Zhuo
 * @author Jakub Kania
 * @author Nyby
 */

import {useEffect, useRef, useState} from 'react';
import Random from '../lib/Random';
import Meteor from '../Meteor';
import {isObject} from 'lodash-es';

function depsFromValuesOf(params) {
  if (isObject(params)) {
    return Object.values(params);
  }
  if (Array.isArray(params)) {
    return params;
  }
  return typeof params === 'undefined' ? [] : [params];
}

function info(msg) {
  console.info(`useMethod: ${msg}`);
}

export default (name, args = {}, dependencies) => {
  const deps = dependencies || [Meteor.userId(), ...depsFromValuesOf(args)];
  const [state, setState] = useState({ result: null, loading: true, err: null, fetching: false });
  const ref = useRef(null);
  const allArgsSet = !Object.values(args).some((x) => x === undefined);
  let p, d;
  if (ref.current === null) {
    ref.current = { id: Random.id() };
  }
  if (Meteor.isVerbose()) {
    p = JSON.stringify(args);
    d = JSON.stringify(deps);
    info(`Init ${name}(${p})${d}, refId=${ref.current.id}`);
  }
  useEffect(() => {
    let mounted = true;
    if (!allArgsSet) {
      if (Meteor.isVerbose()) {
        info(`Args not all set ${name}(${p})${d}`);
      }
      setState({ result: null, loading: false, err: null, fetching: false });
    } else {
      Meteor.call(name, args, (err, result) => {
        if (err) {
          console.log(err);
        }
        if (mounted) {
          if (Meteor.isVerbose()) {
            info(`Returned ${name}(${p})${d}, err=${err}, loading=false, fetching=false, refId=${ref.current.id}`);
          }
          setState({ err, result, loading: false, fetching: false });
        }
      });
      const loading = !Boolean(state.result);
      if (Meteor.isVerbose()) {
        console.log(`Calling ${name}(${p})${d}, err=null, loading=${loading}, fetching=true, refId=${ref.current.id}`);
      }
      setState({ err: null, result: state.result, loading, fetching: true });
    }
    return () => {
      mounted = false;
    };
  }, deps);
  return state;
};
