import express from "express";

const app = express();

const html_string = `
<html>
  <script src="/static/index.es5.js"></script>
  <body>
    Hello world
  </body>
</html>
`;

app.use("/static", express.static("build"));

app.get("/", (req, res) => res.send(html_string));

app.listen(3000, () => console.log("App listening on port 3000!"));
