import sourceMap from "source-map";
// const SourceMapGenerator = require("source-map").SourceMapGenerator;

const SourceMapGenerator = sourceMap.SourceMapGenerator;

/*
 * Depth-first search
 *
 * Check each object property value in AST node
 * If array (will b of nodes) iterate and call traverse(item)
 * If object call traverse(item)
 */
export function visit(ast, callback) {
  callback(ast);

  const keys = Object.keys(ast);
  for (let i = 0; i < keys.length; i++) {
    const keyName = keys[i];
    const child = ast[keyName];
    if (keyName === "loc") return;
    if (Array.isArray(child)) {
      for (let j = 0; j < child.length; j++) {
        visit(child[j], callback);
      }
    } else if (isNode(child)) {
      visit(child, callback);
    }
  }
}
function isNode(node) {
  return typeof node === "object" && node.type;
}

/*
 * Shallow clone.
 * Pass-by-ref so write to reference
 * clone does not have original on
 */
export const cloneOriginalOnAst = ast => {
  visit(ast, node => {
    const clone = Object.assign({}, node);
    node.original = clone;
  });
};

/*
 * Help with Node properties is https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API
 * DONT flatten on cloned, as want to update that AST, not flattened.
 */
export const flattenTokens = ast => {
  const flattenedTokens = [];
  ast.body.map(current => {
    // process each body to help us separate by block/line
    const row = [];
    visit(current, node => {
      if (node.type) {
        const item = {
          type: node.type
          // ALWAYS: location, original
          // SOMETIMES: operator, name, value
        };
        if (node.value) {
          item.value = node.value;
        }
        if (node.name) {
          item.name = node.name;
        }
        if (node.operator) {
          item.operator = node.operator;
        }
        if (node.loc) {
          item.location = node.loc;
        }
        // item.original = Object.assign({}, item);

        // Not needed. Its the identifier
        // if (node.params) {
        //   item.params = node.params;
        // }
        // Not needed. Its the left identifier + right literal
        // if (node.argument) {
        //   item.argument = node.argument;
        // }

        // if (node.type === "FunctionDeclaration") {
        //   console.log("FunctionDeclaration", node);
        // }
        row.push(item);
      }
    });

    flattenedTokens.push(row);
  });
  return flattenedTokens;
};

/*
 * Mapping instance
 */
const mappings = [
  {
    target: {
      start: { line: 1, column: 0 },
      end: { line: 1, column: 0 }
    },
    source: {
      start: { line: 1, column: 0 },
      end: { line: 1, column: 0 }
    },
    name: "START"
  }
];
const sourceFile = "index.es6.js";

const mozillaMap = new SourceMapGenerator({
  file: "index.es5.js"
});

/*
 * Determine lication.
 * NOTE: doesnt use END for sourcemap, but useful for our processing.
 *
 * Get last generated details
 * If line offset
 *  set end column to current column
 *  reset column to 0
 *  increment current line
 */
const buildLocation = ({
  colOffset = 0, lineOffset = 0, name, source, node
}) => {
  let endColumn;
  let startColumn;
  let startLine;
  const lastGenerated = mappings[mappings.length - 1].target;
  const endLine = lastGenerated.end.line + lineOffset;
  if (lineOffset) {
    endColumn = colOffset;
    startColumn = 0; // If new line reset column
    startLine = lastGenerated.end.line + lineOffset;
  } else {
    endColumn = lastGenerated.end.column + colOffset;
    startColumn = lastGenerated.end.column;
    startLine = lastGenerated.end.line;
  }

  const target = {
    start: {
      line: startLine,
      column: startColumn
    },
    end: {
      line: endLine,
      column: endColumn
    }
  };
  node.loc = target;  // Update node with new location

  const clonedNode = Object.assign({}, node);
  delete clonedNode.original; // Only useful for check against original
  const original = node.original;
  if (JSON.stringify(clonedNode) !== JSON.stringify(original)) {
    // Push to real mapping. Just START. END is for me managing state
    mozillaMap.addMapping({
      generated: {
        line: target.start.line,
        column: target.start.column
      },
      source: sourceFile,
      original: source.start
      name
    });
  }

  return myMapping;
};

/*
 * Build mappings
 */
// Utils..copied from "eccodegen"
const space = " ";
const indent = space + space;
const newline = "\n";
const semicolon = ";"; // USUALLY flags on this

// Node statements
const Statements = {
  FunctionDeclaration: function(node) {
    mappings.push(
      buildLocation({
        name: "function",
        colOffset: "function".length,
        source: node.original.loc,
        node
      })
    );

    mappings.push(
      buildLocation({
        name: "_function_ space",
        colOffset: space.length,
        source: node.original.loc,
        node
      })
    );

    let id;
    if (node.id) {
      id = generateIdentifier(node.id);
    } else {
      id = "";
    }
    const body = generateFunctionBody(node);

    // console.log("mappings", mappings[mappings.length - 1].target);

    // block has start + end?
    return ["function", space, id].concat(body); // JOIN
  },
  BlockStatement: function(node) {
    let result = ["{", newline];

    mappings.push(
      buildLocation({
        name: "_function_ {",
        colOffset: "{".length,
        source: node.original.loc,
        node
      })
    );

    // USUALLY withIndent
    // USUALLY for loop on body
    // USUALLY addIndent
    result = result.concat(generateStatement(node.body[0])).flat();
    // result.push(generateStatement(node.body[0])); // JOIN

    // HACK for closing bracket as character node doesnt exist.
    const endBracketLocation = {
      start: node.original.loc.end,
      end: {
        line: 3,
        column: 2
      }
    };
    mappings.push(
      buildLocation({
        name: "_function_ }",
        lineOffset: 1,
        // source: node.original.loc,
        source: endBracketLocation,
        node
      })
    );

    result.push("}");
    result.push("\n");
    return result;
  },
  ReturnStatement: function(node) {
    // USUALLY check for argument else return
    mappings.push(
      buildLocation({
        name: "indent _return_",
        colOffset: indent.length,
        lineOffset: 1,
        source: node.original.loc,
        node
      })
    );

    mappings.push(
      buildLocation({
        name: "return",
        colOffset: "return".length,
        source: node.original.loc,
        node
      })
    );

    mappings.push(
      buildLocation({
        name: "_return_ space",
        colOffset: space.length,
        source: node.original.loc,
        node
      })
    );

    return [
      indent,
      "return",
      space,
      generateExpression(node.argument),
      semicolon,
      newline
    ];
  },
  BinaryExpression: function(node) {
    const left = generateExpression(node.left);

    mappings.push(
      buildLocation({
        name: "_binary expression pre_ space",
        colOffset: " ".length,
        source: node.original.loc,
        node
      })
    );

    mappings.push(
      buildLocation({
        name: `_binary expression_ operator ${node.operator}`,
        colOffset: String(node.operator).length,
        source: node.original.loc,
        node
      })
    );

    mappings.push(
      buildLocation({
        name: "_binary expression post_ space",
        colOffset: " ".length,
        source: node.original.loc,
        node
      })
    );

    const right = generateExpression(node.right);

    return [left, space, node.operator, space, right];
  },
  Literal: function(node) {
    mappings.push(
      buildLocation({
        name: `_literal_ value ${node.value}`,
        colOffset: String(node.value).length,
        source: node.original.loc,
        node
      })
    );

    if (node.value === null) {
      return "null";
    }
    if (typeof node.value === "boolean") {
      return node.value ? "true" : "false";
    }
    return node.value;
  },
  Identifier: function(node) {
    return generateIdentifier(node);
  },
  ExpressionStatement: function(node) {
    const result = generateExpression(node.expression); // was []
    result.push(";");
    return result;
  },
  AssignmentExpression: function(node, precedence) {
    return generateAssignment(node.left, node.right, node.operator, precedence);
  },
  MemberExpression: function(node, precedence) {
    const result = [generateExpression(node.object)];
    result.push(".");
    result.push(generateIdentifier(node.property));
    return parenthesize(result, 19, precedence);
  }
};
// Node processors
function parenthesize(text, current, should) {
  if (current < should) {
    return ["(", text, ")"];
  }
  return text;
}
const generateAssignment = (left, right, operator, precedence) => {
  const expression = [
    generateExpression(left),
    space + operator + space,
    generateExpression(right)
  ];
  return parenthesize(expression, 1, precedence).flat(); // FLATTEN
};
const generateIdentifier = id => {
  mappings.push(
    buildLocation({
      name: `_identifier_ name ${id.name}`,
      colOffset: String(id.name).length,
      source: id.original.loc,
      node: id
    })
  );
  return id.name;
};
const generateFunctionParams = node => {
  mappings.push(
    buildLocation({
      name: `_function_ (`,
      colOffset: "(".length,
      source: node.original.loc,
      node
    })
  );
  mappings.push(
    buildLocation({
      name: `_function_ param name ${node.params[0].name}`,
      colOffset: node.params[0].name.length,
      source: node.original.loc,
      node
    })
  );
  mappings.push(
    buildLocation({
      name: `_function_ )`,
      colOffset: ")".length,
      source: node.original.loc,
      node
    })
  );
  const result = [];
  result.push("(");
  result.push(node.params[0].name); // USUALLY lots of logic to grab param name
  result.push(")");
  return result;
};
const generateStatement = node => {
  const result = Statements[node.type](node);
  return result;
};
const generateFunctionBody = node => {
  const result = generateFunctionParams(node);
  return result.concat(generateStatement(node.body)); // if block generateStatement
  // result.push(generateStatement(node.body)); // JOIN
};
const generateExpression = node => {
  const result = Statements[node.type](node);

  return result;
};
export const getMapping = ast => {
  const code = ast.body
    .map(astBody => Statements[astBody.type](astBody))
    .flat();

  return { mappings, code, mozillaMap };
};
