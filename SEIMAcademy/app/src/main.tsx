import { render } from 'preact';
import './theme/tokens.css';
import './theme/type.css';
import { App } from './app';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing from index.html');
render(<App />, root);
