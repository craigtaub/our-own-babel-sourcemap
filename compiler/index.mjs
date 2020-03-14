import fs from "fs";
import path from "path";
import ast from "abstract-syntax-tree";

const sourceMapTemplate = {
  type: "ExpressionStatement",
  expression: { type: "Identifier", name: "//# sourceMappingURL=file.js.map" }
};

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

const file = "./src/index.js";
const fullPath = path.resolve(file);
const fileContents = fs.readFileSync(fullPath, "utf8");
// console.log("Source:", fileContents);
const sourceAst = ast.parse(fileContents, { loc: true });

const newProgram = {
  type: "Program",
  body: []
};

newProgram.body.push(strictModeTemplate);

sourceAst.body.map(current => {
  const generatedAst = {};
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
      // determine function name, argument variable and return variable
      const functionName = declaration.id.name;
      const argumentName = declaration.init.params[0].name;
      let returnName = declaration.init.body.name;
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
  newProgram.body.push(generatedAst);
});

newProgram.body.push(sourceMapTemplate);

const vendorString = ast.generate(newProgram);
fs.writeFileSync(`./build/file.js`, vendorString, "utf8");

// console.log("Generated: ", ast.generate(newProgram));
