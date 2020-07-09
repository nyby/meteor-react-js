import React, { useEffect, useState, useReducer, forwardRef } from 'react';
import fde from 'fast-deep-equal';
import Trackr from 'trackr';

/**
 * Wrap useEffect that calls func only when the component is mounted.
 * @param triggers {array} list of properties to observe that will trigger a data fetch
 * @param func {function(mounted:{current:boolean}):void}
 * @param throttle {number}
 */
export function withEffect(triggers, func, { throttle = 2000 } = {}) {
  const mounted = useRef(false);
  const getMeteorData = debounce(func, throttle, { leading: true, trailing: false });
  useEffect(() => {
    mounted.current = true;
    getMeteorData(mounted);
    return () => {
      mounted.current = false;
    };
  }, triggers);
}


export function withTracker(options, mapStateToProps) {
  let expandedOptions = options;
  if (typeof options === 'function') {
    expandedOptions = {
      getMeteorData: options,
    };
  }

  const { getMeteorData } = expandedOptions;

  // coalesce meteor api calls, only fire the first call within the throttle time (ms)
  // const getMeteorData = debounce(func, throttle, { leading: true, trailing: false });
  return WrappedComponent => {
    let data = {};
    let computation = null;

    const WrappedComponentWithRef = props => {
      let mounted = true;
      const [ ignored, forceUpdate ] = useReducer(x => x + 1, 0);
      const { forwardedRef, ...rest } = props;

      useEffect(() => {
        calculateData();
        return () => {
          stopComputation();
          mounted = false;
        };
      }, [ props ]);

      function stopComputation() {
        if (computation) {
          computation.stop();
          computation = null;
        }
      }

      function calculateData() {
        computation = Trackr.nonreactive(() => {
          Trackr.autorun(() => {
            const newData = getMeteorData(props);
            const dataEqual = fde(data, newData);
            if (!dataEqual && mounted) {
              data = newData;
              forceUpdate();
            }
          });
        });
      }

      return <WrappedComponent ref={forwardedRef} {...rest} {...data} />;
    };

    const RefComponent = forwardRef((props, ref) => {
      return <WrappedComponentWithRef {...props} forwardedRef={ref} />;
    });

    if (mapStateToProps) {
      return connectWithRef(mapStateToProps)(RefComponent);
    }

    return RefComponent;
  };
}


export function useTracker(fn, deps = []) {
  const [ data, setData ] = useState(fn());
  let computation = null;

  const stopComputation = () => {
    computation && computation.stop();
    computation = null;
  };

  useEffect(() => {
    stopComputation();
    Trackr.autorun(currentComputation => {
      computation = currentComputation;
      const newData = fn();
      const dataEqual = fde(data, newData);
      if (!dataEqual) {
        setData(newData);
      }
    });
    return () => stopComputation();
  }, [ ...deps ]);

  return data;
};
