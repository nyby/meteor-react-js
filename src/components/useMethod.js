/**
 * @author Piotr Falba
 * @author Wei Zhuo
 * @author Jakub Kania
 * @author Nyby
 */

import { useEffect, useState } from 'react';

import Meteor from '../Meteor';

export default (name, args = {}, deps = [], executeOnMount = false) => {
  const [state, setState] = useState({ result: null, loading: true });
  const allArgsSet = !Object.values(args).some((x) => x === undefined);

  const executeCall = (mounted) => {
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
  };

  useEffect(() => {
    let mounted = true;
    executeCall(mounted);
    return () => {
      mounted = false;
    };
  }, deps);

  useEffect(() => {
    let mounted = true;
    executeOnMount && executeCall(mounted);
    return () => {
      mounted = false;
    };
  }, []);

  return state;
};
