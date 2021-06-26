/**
 * @author Piotr Falba
 * @author Wei Zhuo
 * @author Jakub Kania
 * @author Nyby
 */

import { useEffect, useState } from 'react';

import Meteor from '../Meteor';

export default (name, args = {}, deps = []) => {
  const [state, setState] = useState({ result: null, loading: true });
  const allArgsSet = !Object.values(args).some(x => x === undefined);

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
