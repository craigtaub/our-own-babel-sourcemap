# Compiler rules

1. Transform

- const change to var
- arrow function change to expression
- Implicit return become explicit

2. Don't map Keywords, only

- variable itself
- function contents
- WHY: think as tricky and useless to track

3. Use AST so we can grab line and column numbers easily

console.log("NEW: ", JSON.stringify(ast.parse(`hello`)));
