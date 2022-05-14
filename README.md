# Meteor React JS

This package is based on the `@meteorrn/core` package for React Native. 
Some little adjustments to make it work in the browser. All credits for the 
awesome work should go to the maintainers of the original package for React Native. 
Feel free to comment, contribute and fix. A hook version 
called `Meteor.useTracker` is also available.

A set of packages allowing you to connect your React app to your Meteor server, 
and take advantage of Meteor-specific features like accounts, reactive data 
trackers, etc. Compatible with the latest version of React.

[Full API Documentation](/docs/api.md)

## Installation

~~~
npm install --save @nyby/meteor-react-js
~~~

## Basic Usage

```javascript
import Meteor from '@nyby/meteor-react-js';

// "mycol" should match the name of the collection on your meteor server
let MyCol = new Meteor.Mongo.Collection('mycol');

// Note the /websocket after your URL
Meteor.connect('wss://myapp.meteor.com/websocket'); 

class App extends React.Component {
  render() {
    let { myThing } = this.props;

    return (
      <div>
        <span>Here is the thing: {myThing.name}</span>
      </div>
    );
  }
}

let AppContainer = Meteor.withTracker(() => {
  Meteor.subscribe('myThing');
  let myThing = MyCol.findOne();

  return {
    myThing,
  };
})(App);

export default AppContainer;
```

## Custom hooks

There are also custom hooks for managing subscriptions and calling Meteor methods implemented.

### Meteor.usePublication

```javascript
const [data, loading] = Meteor.usePublication({
  name: 'publication.name',
  params: { id: _id },
  fetch: () => MyCol.findOne({ _id: id }),
});
```

### Meteor.useMethod

```javascript
const { result, loading } = Meteor.useMethod('method.name', { id: _id });
```
