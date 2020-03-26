import fs from "fs";
import path from "path";
import ast from "abstract-syntax-tree";
import vlq from "vlq";
import { visit, cloneOriginalOnAst, getMapping } from "./ast-util.mjs";

const file = "./src/index.es6.js";
const fullPath = path.resolve(file);
const fileContents = fs.readFileSync(fullPath, "utf8");
const sourceAst = ast.parse(fileContents, { loc: true });

// AST lib is SHIT
// testAstring(sourceAst, fileContents);

// 1. add shallow clone of each node onto AST
cloneOriginalOnAst(sourceAst);
// console.log("sourceAst", sourceAst.body[0].body.original);

// 2. update AST.
// usually a API calls would do this.
// swap "number + 1"
const leftClone = Object.assign(
  {},
  sourceAst.body[0].body.body[0].argument.left
);
sourceAst.body[0].body.body[0].argument.left =
  sourceAst.body[0].body.body[0].argument.right;
sourceAst.body[0].body.body[0].argument.right = leftClone;

// now "1 + number". loc is wrong
// console.log(
//   sourceAst.body[0].body.body[0].argument.left,
//   sourceAst.body[0].body.body[0].argument.right
// );

// 3. Mapping
const { mappings, code, mozillaMap } = getMapping(sourceAst);
// console.log("mappings:", JSON.stringify(mappings));
// console.log("code:", code);
// console.log("mozillaMap:", mozillaMap);
mozillaMap.setSourceContent(fileContents); // Is this needed? not sure

// Map from mozillas
fs.writeFileSync(`./test-runs/index.js.map`, mozillaMap.toString(), "utf8");
