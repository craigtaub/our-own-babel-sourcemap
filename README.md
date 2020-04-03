# Our own babel sourcemaps

Test application, contains a small JS code generation compiler. Transform small subset of JS AST into real code and produce the source map.

## Transformation

Change:

```javascript
function add(number) {
  return number + 1;
}
```

Into:

```javascript
function add(number) {
  return 1 + number;
}
```

## Usage

`npm run compile`

Compile `src/index.es6.js` into `/build` with updated file and source map.

`npm run start`

Compile and start simple express server loading JS assets.
