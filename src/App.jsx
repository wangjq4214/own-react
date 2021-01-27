import Own from './own';

/** @jsx Own.createElement */
const Element = props => (
  <div style="background: salmon">
    <h1>Hello {props.name}</h1>
    <h2 style="text-align:right">from WJQ</h2>
  </div>
);

export const App = <Element name="World" />;
