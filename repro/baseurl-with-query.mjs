// 复现：baseURL 里带查询串时，相对路径被拼到了查询串后面
import http from "node:http";
import axios from "../index.js";

const server = http.createServer((req, res) => {
  res.setHeader("content-type", "text/plain");
  res.end("服务端收到 " + req.url);
});

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}/api?token=t1`;
  const cli = axios.create({ baseURL: base });

  const r1 = await cli.get("/users");
  console.log("带查询串的 baseURL 发出去 ->", r1.data);
  console.log("带查询串的 baseURL getUri ->", cli.getUri({ url: "/users" }));

  const cli2 = axios.create({ baseURL: base.replace("?token=t1", "") });
  console.log("对照：无查询串 baseURL ->", (await cli2.get("/users")).data);
  console.log("对照：无查询串 getUri   ->", cli2.getUri({ url: "/users" }));

  const cli3 = axios.create({ baseURL: base });
  console.log("带查询串再加 params ->", cli3.getUri({ url: "/users", params: { page: 2 } }));
  server.close();
});
