# Meteor React JS

This package is based on the `@meteorrn/core` package for React Native. I just made some little adjustments to make it work in the browser. All credits for the awesome work should go to the maintainers of the original package for React Native. Feel free to comment, contribute and fix. A hook version called `useTracker` is also available.

A set of packages allowing you to connect your React app to your Meteor server, and take advantage of Meteor-specific features like accounts, reactive data trackers, etc. Compatible with the latest version of React.

[Full API Documentation](/docs/api.md)

# Installation

`npm install --save meteor-react-js`

# Basic Usage

```javascript
import Meteor, { Mongo, withTracker } from 'meteor-react-js';

// "mycol" should match the name of the collection on your meteor server, or pass null for a local collection
let MyCol = new Mongo.Collection('mycol');

Meteor.connect('wss://myapp.meteor.com/websocket'); // Note the /websocket after your URL

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

let AppContainer = withTracker(() => {
  Meteor.subscribe('myThing');
  let myThing = MyCol.findOne();

  return {
    myThing,
  };
})(App);

export default AppContainer;
```
