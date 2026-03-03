import { render } from "preact";
import { App } from "./app.js";
import "./styles/eink.css";

render(<App />, document.getElementById("app")!);
