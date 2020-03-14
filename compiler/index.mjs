import fs from "fs";
import path from "path";
import ast from "abstract-syntax-tree";
import vlq from "vlq";

const assignmentLength = "=".length;
const functionKeywordLength = "function".length;
const bracketLength = "(".length;
const spaceLength = " ".length;
const returnLength = "return".length;

const buildSourceMapTemplate = (mappingsString, fileContents) => `
{
  "version": 3,
  "sources": ["index.es6.js"],
  "names": [],
  "mappings": ";;${mappingsString}",
  "file": "index.es5.js",
  "sourcesContent": ["${fileContents.trim().replace(/\n/g, "\\n")}"]
}
`;

const strictModeTemplate = {
  type: "ExpressionStatement",
  expression: { type: "Literal", value: "use strict" }
};

const buildFunExpressionDeclarationTemplate = (
  functionName,
  argumentName,
  returnName
) => ({
  type: "VariableDeclarator",
  init: {
    type: "FunctionExpression",
    params: [
      {
        type: "Identifier",
        name: argumentName
      }
    ],
    body: {
      type: "BlockStatement",
      body: [
        {
          type: "ReturnStatement",
          argument: {
            type: "Identifier",
            name: returnName
          }
        }
      ]
    },
    async: false,
    generator: false,
    id: {
      type: "Identifier",
      name: functionName
    }
  },
  id: {
    type: "Identifier",
    name: functionName
  }
});

const file = "./src/index.es6.js";
const fullPath = path.resolve(file);
const fileContents = fs.readFileSync(fullPath, "utf8");
const sourceAst = ast.parse(fileContents, { loc: true });

const newProgram = {
  type: "Program",
  body: []
};

// Add strictmode template to header
newProgram.body.push(strictModeTemplate);

// column position is 0 indexed.
let currentGeneratedColumn = 0;
let currentGeneratedLine = 1;
const sourceMapStorage = [];
const generatedAst = {};

// for now only 1 line
sourceAst.body.map(current => {
  if (!current.declarations) {
    // non declarations, generate as is
    newProgram.body.push(current);
    return;
  }
  if (current.type === "VariableDeclaration" && current.kind === "const") {
    // swap const keyword for var
    generatedAst.type = "VariableDeclaration";
    generatedAst.kind = "var";
  }
  const updatedDeclarations = [];
  current.declarations.map(declaration => {
    if (
      declaration.type === "VariableDeclarator" &&
      declaration.init.type === "ArrowFunctionExpression"
    ) {
      // 1. determine function name
      const functionName = declaration.id.name;

      const functionNameSourcePosition = declaration.id.loc.start; // ignore end for now
      currentGeneratedColumn += 4; // just var so far
      sourceMapStorage.push({
        name: "functionName",
        source: {
          col: functionNameSourcePosition.column,
          line: functionNameSourcePosition.line
        },
        generated: {
          col: currentGeneratedColumn,
          line: currentGeneratedLine
        }
      });

      // 2. determine argument name
      const argumentName = declaration.init.params[0].name;

      // sourcemap stuff
      const argumentNameSourcePosition = declaration.init.params[0].loc.start; // ignore end for now
      // funtionName+space+assignment+space+function+space+functionName+bracket
      currentGeneratedColumn +=
        functionName.length +
        spaceLength +
        assignmentLength +
        spaceLength +
        functionKeywordLength +
        spaceLength +
        functionName.length +
        bracketLength;
      sourceMapStorage.push({
        name: "argumentName",
        source: {
          col: argumentNameSourcePosition.column,
          line: argumentNameSourcePosition.line
        },
        generated: {
          col: currentGeneratedColumn,
          line: currentGeneratedLine
        }
      });

      // 3. determine return name
      const returnName = declaration.init.body.name;

      // sourcemap stuff
      const returnNameSourcePosition = declaration.init.body.loc.start; // ignore end for now
      currentGeneratedLine++;
      currentGeneratedColumn = 0; // reset
      // newline return is double spaced
      currentGeneratedColumn +=
        spaceLength + spaceLength + returnLength + spaceLength;
      sourceMapStorage.push({
        name: "returnName",
        source: {
          col: returnNameSourcePosition.column,
          line: returnNameSourcePosition.line
        },
        generated: {
          col: currentGeneratedColumn,
          line: currentGeneratedLine
        }
      });

      // BAD coupled to arrow function implicit return

      // create function expression with correct names
      updatedDeclarations.push(
        buildFunExpressionDeclarationTemplate(
          functionName,
          argumentName,
          returnName
        )
      );
    }
  });
  generatedAst.declarations = updatedDeclarations;
  // add new ast to our new program
  newProgram.body.push(generatedAst);
});

// add sourcemap ref here
const vendorString =
  ast.generate(newProgram) + "//# sourceMappingURL=/static/file.es5.js.map";

// Write compiled code to bundle
fs.writeFileSync(`./build/file.es5.js`, vendorString, "utf8");

const mappingsString = sourceMapStorage.reduce((acc, item, index) => {
  // Generate mappings
  const sourceArray = [];
  sourceArray.push(item.generated.col); // 0 = column index in compiled file
  sourceArray.push("file.es6.js"); // 1 - what original source file the location in the compiled source maps to
  sourceArray.push(item.source.line); // 2 - row index in original source file (i.e line number)
  sourceArray.push(item.source.col); // 3 - column index in original source file
  const encoded = vlq.encode(sourceArray);

  if (!sourceMapStorage[index + 1]) {
    acc += acc + encoded;
  } else {
    acc += acc + encoded + ",";
  }
  return acc;
}, "");

// replace line breaks with line break for browser
const sourceMapString = buildSourceMapTemplate(mappingsString, fileContents);

// console.log(sourceMapString);
// Write sourcemap to file
fs.writeFileSync(`./build/file.es5.js.map`, sourceMapString, "utf8");
