import { useState, useEffect } from 'react';
import { isObject } from 'lodash';

import Meteor from '../Meteor';

export default (name, args = {}, deps = []) => {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let mounted = true;
    if (typeof lastArg === 'function' && lastArg() === false) {
      setState({ result: null });
    } else {
      Meteor.call(name, args, (err, result) => {
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
  }, deps);
  return state;
};
