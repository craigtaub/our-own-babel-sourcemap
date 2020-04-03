import fs from "fs";
import path from "path";
import ast from "abstract-syntax-tree";
import vlq from "vlq";
import { visit, cloneOriginalOnAst, getMapping } from "./ast-util.mjs";

const file = "./src/index.es6.js";
const fullPath = path.resolve(file);
const fileContents = fs.readFileSync(fullPath, "utf8");
const sourceAst = ast.parse(fileContents, { loc: true });

// 1. add shallow clone of each node onto AST
cloneOriginalOnAst(sourceAst);

// 2. Update AST. Usually a API calls would do this.
// Swap: "number + 1"
// - clone left node
const leftClone = Object.assign(
  {},
  sourceAst.body[0].body.body[0].argument.left
);
// - replace left node with right node
sourceAst.body[0].body.body[0].argument.left =
  sourceAst.body[0].body.body[0].argument.right;
// - replace right node with left clone
sourceAst.body[0].body.body[0].argument.right = leftClone;
// Now: "1 + number". Note: loc is wrong

// 3. Mapping
const { mappings, code, mozillaMap } = getMapping(sourceAst);
mozillaMap.setSourceContent(fileContents);

// Map from mozillas
fs.writeFileSync(`./build/index.es5.js.map`, mozillaMap.toString(), "utf8");

// Add sourcemap location
code.push("\n");
code.push("//# sourceMappingURL=/static/index.es5.js.map");

fs.writeFileSync(`./build/index.es5.js`, code.join(""), "utf8");
fs.writeFileSync(`./build/index.es6.js`, fileContents, "utf8");
