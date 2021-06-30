import Data from './Data';
import Meteor from './Meteor';

function debugMethod(name, params) {
  const args = JSON.stringify(params).replace(/^\[|\]$/g, '');
  return `"${name}"(${args})`;
}

function info(msg) {
  console.info(`Call: ${msg}`);
}

export default function(eventName) {
  const args = Array.prototype.slice.call(arguments, 1);
  let callback;
  if (args.length && typeof args[args.length - 1] === 'function') {
    callback = args.pop();
  }
  const id = Data.ddp.method(eventName, args);
  if (Meteor.isVerbose()) {
    info(`Call: Method ${debugMethod(eventName, args)}, id=${id}`);
  }
  Data.calls.push({ id, callback });
}
