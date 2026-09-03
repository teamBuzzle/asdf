import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import "@xterm/xterm/css/xterm.css";
import "./index.css";
import "@/app/i18n";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
