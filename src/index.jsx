/** @jsx Own.createElement */
import Own from './own';
// import { App } from './App';

const container = document.getElementById('root');

const updateValue = e => {
  rerender(e.target.value);
};

const rerender = value => {
  const element = (
    <div>
      <input onInput={updateValue} value={value} />
      <h2>Hello {value}</h2>
    </div>
  );
  Own.render(element, container);
};

rerender('World');

// Own.render(App, container);
