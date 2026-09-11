/**
 * DOM environment plus the resolve hook, loaded with `node --import` so both are in place
 * before any test module is evaluated. Registering happy-dom inside a test file is too
 * late: that file's own imports have already run.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

register('./resolve-hook.mjs', pathToFileURL(`${import.meta.dirname}/`));
GlobalRegistrator.register({ url: 'https://seim.test/' });
