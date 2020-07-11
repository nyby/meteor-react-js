import React, { useEffect, useState, useReducer, forwardRef, useRef, useMemo } from 'react';
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


export function useTracker(reactiveFn, deps = null, computationHandler) {
  const fur = x => x + 1;
  const useForceUpdate = () => {
    const [ , forceUpdate ] = useReducer(fur, 0);
    return forceUpdate;
  };
  // The follow functions were hoisted out of the closure to reduce allocations.
  // Since they no longer have access to the local vars, we pass them in and mutate here.
  const dispose = refs => {
    if (refs.computationCleanup) {
      refs.computationCleanup();
      delete refs.computationCleanup;
    }
    if (refs.computation) {
      refs.computation.stop();
      refs.computation = null;
    }
  };
  const runReactiveFn = (refs, c) => {
    refs.trackerData = refs.reactiveFn(c);
  };
  const clear = refs => {
    if (refs.disposeId) {
      clearTimeout(refs.disposeId);
      delete refs.disposeId;
    }
  };
  const track = (refs, forceUpdate, trackedFn) => {
    // Use Tracker.nonreactive in case we are inside a Tracker Computation.
    // This can happen if someone calls `ReactDOM.render` inside a Computation.
    // In that case, we want to opt out of the normal behavior of nested
    // Computations, where if the outer one is invalidated or stopped,
    // it stops the inner one.
    Trackr.nonreactive(() =>
      Trackr.autorun(c => {
        refs.computation = c;
        trackedFn(c, refs, forceUpdate);
      })
    );
  };
  const doFirstRun = (refs, c) => {
    // If there is a computationHandler, pass it the computation, and store the
    // result, which may be a cleanup method.
    if (refs.computationHandler) {
      const cleanupHandler = refs.computationHandler(c);
      if (cleanupHandler) {
        refs.computationCleanup = cleanupHandler;
      }
    }
    // Always run the reactiveFn on firstRun
    runReactiveFn(refs, c);
  };
  const tracked = (c, refs, forceUpdate) => {
    console.log('tracked', c.firstRun, refs.isMounted);
    if (c.firstRun) {
      doFirstRun(refs, c);
    } else if (refs.isMounted) {
      // Only run the reactiveFn if the component is mounted.
      runReactiveFn(refs, c);
      forceUpdate();
    } else {
      // If we got here, then a reactive update happened before the render was
      // committed - before useEffect has run. We don't want to run the reactiveFn
      // while we are not sure this render will be committed, so we'll dispose of the
      // computation, and set everything up to be restarted in useEffect if needed.
      // NOTE: If we don't run the user's reactiveFn when a computation updates, we'll
      // leave the computation in a non-reactive state - so we need to dispose here
      // and let useEffect recreate the computation later.
      dispose(refs);
      // Might as well clear the timeout!
      clear(refs);
    }
  };
  const useTrackerNoDeps = (reactiveFn, deps = null, computationHandler) => {
    // const [ data, setData ] = useState(reactiveFn());
    const { current: refs } = useRef({
      reactiveFn,
      isMounted: false,
      trackerData: null,
    });
    const forceUpdate = useForceUpdate();
    refs.reactiveFn = reactiveFn;
    if (computationHandler) {
      refs.computationHandler = computationHandler;
    }
    // Without deps, always dispose and recreate the computation with every render.
    dispose(refs);
    track(refs, forceUpdate, c => {
      if (c.firstRun) {
        doFirstRun(refs, c);
      } else {
        // For any reactive change, forceUpdate and let the next render rebuild the computation.
        forceUpdate();
      }
    });
    // To avoid creating side effects in render with Tracker when not using deps
    // create the computation, run the user's reactive function in a computation synchronously,
    // then immediately dispose of it. It'll be recreated again after the render is committed.
    if (!refs.isMounted) {
      // We want to forceUpdate in useEffect to support StrictMode.
      // See: https://github.com/meteor/react-packages/issues/278
      dispose(refs);
    }
    useEffect(() => {
      // console.log('data', data);
      // Let subsequent renders know we are mounted (render is comitted).
      refs.isMounted = true;
      // Render is committed. Since useTracker without deps always runs synchronously,
      // forceUpdate and let the next render recreate the computation.
      forceUpdate();
      // stop the computation on unmount
      return () => dispose(refs);
    }, []);
    return refs.trackerData;
  };

  const useTrackerWithDeps = (reactiveFn, deps, computationHandler) => {
    const { current: refs } = useRef({
      reactiveFn,
      isMounted: false,
      trackerData: null,
    });
    const forceUpdate = useForceUpdate();
    // Always have up to date deps and computations in all contexts
    refs.reactiveFn = reactiveFn;
    refs.deps = deps;
    if (computationHandler) {
      refs.computationHandler = computationHandler;
    }
    // We are abusing useMemo a little bit, using it for it's deps
    // compare, but not for it's memoization.
    useMemo(() => {
      // stop the old one.
      dispose(refs);
      track(refs, forceUpdate, tracked);
      // Tracker creates side effect in render, which can be problematic in some cases, such as
      // Suspense or concurrent rendering or if an error is thrown and handled by an error boundary.
      // We still want synchronous rendering for a number of reasons (see readme). useTracker works
      // around memory/resource leaks by setting a time out to automatically clean everything up,
      // and watching a set of references to make sure everything is choreographed correctly.
      if (!refs.isMounted) {
        // Components yield to allow the DOM to update and the browser to paint before useEffect
        // is run. In concurrent mode this can take quite a long time. 1000ms should be enough
        // in most cases.
        refs.disposeId = setTimeout(() => {
          if (!refs.isMounted) {
            dispose(refs);
          }
        }, 1000);
      }
    }, deps);
    useEffect(() => {
      refs.isMounted = true;
      // Render is committed, clear the dispose timeout
      clear(refs);
      // If it took longer than 1000ms to get to useEffect, or a reactive update happened
      // before useEffect, restart the computation and forceUpdate.
      if (!refs.computation) {
        // This also runs runReactiveFn
        track(refs, forceUpdate, tracked);
        forceUpdate();
      }
      // stop the computation on unmount
      return () => dispose(refs);
    }, []);
    return refs.trackerData;
  };

  return deps === null || deps === undefined || !Array.isArray(deps) ? useTrackerNoDeps(reactiveFn, deps, computationHandler) : useTrackerWithDeps(reactiveFn, deps, computationHandler)
}

export function useSubscription() {} //TBD
