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
  let mounted = true;

  const executeCall = () => {
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
    executeCall();
    return () => {
      mounted = false;
    };
  }, deps);

  useEffect(() => {
    executeOnMount && executeCall();
    return () => {
      mounted = false;
    };
  }, []);

  return state;
};
