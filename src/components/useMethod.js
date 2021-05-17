import { useState, useEffect } from 'react';
import { isObject } from 'lodash';

import Meteor from '../Meteor';

export default (name, ...args) => {
  const [state, setState] = useState({ loading: true });
  const lastArg = args[args?.length - 1];
  let deps = Array.isArray(lastArg) ? lastArg : [];
  useEffect(() => {
    let mounted = true;
    if (typeof lastArg === 'function' && lastArg() === false) {
      setState({ result: null });
    } else {
      const a = !Array.isArray(lastArg) ? args : [];
      Meteor.call(name, ...a, (err, result) => {
        if (err) {
          console.log(err);
        }
        if (mounted) {
          setState({ err, result, loading: false });
        }
      });
    }

    return () => {
      mounted = false;
    };
  }, [...deps]);
  return state;
};
