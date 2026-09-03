import type {
	ChangedFile,
	DiffRow,
	FileNode,
	Group,
	Project,
	Session,
} from "./types";

type RawFile = Omit<ChangedFile, "rows"> & { rows: Omit<DiffRow, "id">[] };
type RawSession = Omit<Session, "files"> & { files: RawFile[] };

// ponytail: fixtures shaped like the IPC contract that will replace them.
// There are no session, tree or diff commands in src-tauri yet; when there are,
// this file goes and use-sessions reads from src/ipc/client.
// Content is Korean because that is what a Korean team's sessions look like;
// repository and branch names stay English because git does.

const webTree: FileNode[] = [
	{
		kind: "dir",
		name: "src",
		path: "src",
		children: [
			{
				kind: "dir",
				name: "app",
				path: "src/app",
				children: [
					{
						kind: "file",
						name: "router.ts",
						path: "src/app/router.ts",
						status: "added",
					},
					{
						kind: "file",
						name: "i18n.ts",
						path: "src/app/i18n.ts",
						status: "modified",
					},
				],
			},
			{
				kind: "dir",
				name: "ipc",
				path: "src/ipc",
				children: [
					{
						kind: "file",
						name: "client.ts",
						path: "src/ipc/client.ts",
						status: "modified",
					},
					{
						kind: "file",
						name: "bindings.ts",
						path: "src/ipc/bindings.ts",
						status: "clean",
					},
				],
			},
			{
				kind: "file",
				name: "auth.ts",
				path: "src/auth.ts",
				status: "modified",
			},
			{ kind: "file", name: "main.tsx", path: "src/main.tsx", status: "clean" },
		],
	},
	{
		kind: "dir",
		name: "tests",
		path: "tests",
		children: [
			{
				kind: "file",
				name: "auth.test.ts",
				path: "tests/auth.test.ts",
				status: "clean",
			},
		],
	},
	{ kind: "file", name: "README.md", path: "README.md", status: "clean" },
	{ kind: "file", name: "package.json", path: "package.json", status: "clean" },
];

const webSources: Record<string, string[]> = {
	"src/ipc/bindings.ts": [
		"export type WorkspaceInfo = {",
		"\tpath: string;",
		"\tname: string;",
		"\tisGitRepo: boolean;",
		"};",
	],
	"src/main.tsx": [
		'import ReactDOM from "react-dom/client";',
		'import { App } from "@/app/App";',
		"",
		"ReactDOM.createRoot(root).render(<App />);",
	],
	"tests/auth.test.ts": [
		'test("로그인 리다이렉트", () => {',
		"\texpect(redirect(null)).toBe(null);",
		"});",
	],
	"README.md": ["# web", "", "로그인과 대시보드를 담당하는 프런트엔드."],
	"package.json": ["{", '\t"name": "web",', '\t"private": true', "}"],
};

const raw: RawSession[] = [
	{
		id: "s1",
		projectId: "p1",
		title: "리다이렉트 루프 고치기",
		branch: "fix/login-redirect",
		ahead: 3,
		behind: 0,
		agent: "claude · sonnet",
		status: "waiting",
		blockedOn: "`pnpm install` 실행할까요?",
		tree: webTree,
		sources: webSources,
		files: [
			{
				path: "src/auth.ts",
				kind: "modified",
				added: 42,
				removed: 8,
				review: "new",
				rows: [
					{
						kind: "same",
						before: { n: 10, text: "export function guard(session, from) {" },
						after: { n: 10, text: "export function guard(session, from) {" },
					},
					{
						kind: "same",
						before: { n: 11, text: "\tif (!session) {" },
						after: { n: 11, text: "\tif (!session) {" },
					},
					{
						kind: "change",
						before: { n: 12, text: '\t\treturn redirect("/login")' },
						after: { n: 12, text: '\t\tif (from === "/login") return null' },
					},
					{
						kind: "add",
						after: { n: 13, text: '\t\treturn redirect("/login")' },
					},
					{
						kind: "same",
						before: { n: 13, text: "\t}" },
						after: { n: 14, text: "\t}" },
					},
					{ kind: "del", before: { n: 14, text: "\t// TODO: 루프 방지" } },
					{
						kind: "same",
						before: { n: 15, text: "}" },
						after: { n: 15, text: "}" },
					},
				],
			},
			{
				path: "src/app/router.ts",
				kind: "added",
				added: 18,
				removed: 0,
				review: "new",
				rows: [
					{
						kind: "add",
						after: { n: 1, text: 'import { route } from "./route"' },
					},
					{ kind: "add", after: { n: 2, text: "" } },
					{ kind: "add", after: { n: 3, text: "export const routes = [" } },
					{ kind: "add", after: { n: 4, text: '\troute("/login"),' } },
					{ kind: "add", after: { n: 5, text: '\troute("/dashboard"),' } },
					{ kind: "add", after: { n: 6, text: "]" } },
				],
			},
			{
				path: "src/ipc/client.ts",
				kind: "modified",
				added: 9,
				removed: 2,
				review: "new",
				rows: [
					{
						kind: "same",
						before: { n: 29, text: "export const ipc = {" },
						after: { n: 29, text: "export const ipc = {" },
					},
					{
						kind: "same",
						before: { n: 30, text: "\topenWorkspace," },
						after: { n: 30, text: "\topenWorkspace," },
					},
					{ kind: "add", after: { n: 31, text: "\tlistSessions," } },
					{
						kind: "same",
						before: { n: 31, text: "}" },
						after: { n: 32, text: "}" },
					},
				],
			},
			{
				path: "src/app/i18n.ts",
				kind: "modified",
				added: 2,
				removed: 0,
				review: "reviewed",
				rows: [
					{
						kind: "same",
						before: { n: 20, text: "const resources = {" },
						after: { n: 20, text: "const resources = {" },
					},
					{ kind: "add", after: { n: 21, text: "\tko: { translation: ko }," } },
					{
						kind: "same",
						before: { n: 21, text: "}" },
						after: { n: 22, text: "}" },
					},
				],
			},
		],
	},
	{
		id: "s2",
		projectId: "p2",
		title: "API 토큰 교체",
		branch: "chore/rotate-token",
		ahead: 1,
		behind: 2,
		agent: "claude · sonnet",
		status: "running",
		tree: [
			{
				kind: "dir",
				name: "src",
				path: "src",
				children: [
					{
						kind: "file",
						name: "token.rs",
						path: "src/token.rs",
						status: "clean",
					},
				],
			},
		],
		sources: {
			"src/token.rs": ["pub fn rotate() -> Result<()> {", "\tOk(())", "}"],
		},
		files: [],
	},
	{
		id: "s3",
		projectId: "p1",
		title: "문서 갱신",
		branch: "docs/login-flow",
		ahead: 1,
		behind: 0,
		agent: "gemini",
		status: "done",
		tree: [
			{
				kind: "file",
				name: "README.md",
				path: "README.md",
				status: "modified",
			},
		],
		sources: {},
		files: [
			{
				path: "README.md",
				kind: "modified",
				added: 6,
				removed: 1,
				review: "reviewed",
				rows: [
					{
						kind: "same",
						before: { n: 7, text: "## 시작하기" },
						after: { n: 7, text: "## 시작하기" },
					},
					{
						kind: "change",
						before: { n: 8, text: "pnpm install 을 먼저 실행하세요." },
						after: { n: 8, text: "pnpm bootstrap 을 먼저 실행하세요." },
					},
				],
			},
		],
	},
	{
		id: "s4",
		projectId: "p3",
		title: "CSV 내보내기",
		branch: "feat/export-csv",
		ahead: 2,
		behind: 5,
		agent: "codex",
		status: "failed",
		blockedOn: "cargo test — 2개 실패",
		tree: [
			{
				kind: "dir",
				name: "src",
				path: "src",
				children: [
					{
						kind: "file",
						name: "export.rs",
						path: "src/export.rs",
						status: "modified",
					},
				],
			},
		],
		sources: {},
		files: [
			{
				path: "src/export.rs",
				kind: "modified",
				added: 12,
				removed: 4,
				review: "new",
				rows: [
					{
						kind: "same",
						before: { n: 4, text: "fn export() -> Result<()> {" },
						after: { n: 4, text: "fn export() -> Result<()> {" },
					},
					{
						kind: "change",
						before: { n: 5, text: "\ttodo!()" },
						after: { n: 5, text: "\twrite_csv(rows)?;" },
					},
					{ kind: "add", after: { n: 6, text: "\tOk(())" } },
					{
						kind: "same",
						before: { n: 6, text: "}" },
						after: { n: 7, text: "}" },
					},
				],
			},
		],
	},
	{
		id: "s5",
		projectId: "p4",
		title: "배포 스크립트 정리",
		branch: "chore/deploy-tidy",
		ahead: 0,
		behind: 0,
		agent: "claude · sonnet",
		status: "idle",
		tree: [
			{ kind: "file", name: "deploy.sh", path: "deploy.sh", status: "clean" },
		],
		sources: { "deploy.sh": ["#!/bin/sh", "set -eu", "echo 배포"] },
		files: [],
	},
	{
		id: "s6",
		projectId: "p5",
		title: "Tauri 버전 올리기",
		branch: "chore/bump-tauri",
		ahead: 1,
		behind: 0,
		agent: "codex",
		status: "done",
		tree: [
			{
				kind: "dir",
				name: "src-tauri",
				path: "src-tauri",
				children: [
					{
						kind: "file",
						name: "Cargo.toml",
						path: "src-tauri/Cargo.toml",
						status: "modified",
					},
				],
			},
		],
		sources: {},
		files: [
			{
				path: "src-tauri/Cargo.toml",
				kind: "modified",
				added: 1,
				removed: 1,
				review: "reviewed",
				rows: [
					{
						kind: "change",
						before: { n: 12, text: 'tauri = "2.10"' },
						after: { n: 12, text: 'tauri = "2.11"' },
					},
				],
			},
		],
	},
];

export const mockGroups: Group[] = [
	{ id: "login", name: "로그인 개편" },
	{ id: "client-a", name: "A사" },
	{ id: "ungrouped", name: "미분류" },
];

// The same repository can sit in two groups; each is its own project entry.
export const mockProjects: Project[] = [
	{
		id: "p1",
		name: "project_1",
		groupId: "login",
		branch: "main",
		issues: [
			{
				number: 42,
				title: "로그인 후 리다이렉트가 무한 루프",
				state: "open",
				labels: ["type:fix", "priority:high"],
				author: "devxian96",
				body: "로그인에 성공한 뒤 /login 으로 다시 돌아옵니다.\n\n재현: 세션이 만료된 상태에서 /dashboard 로 접근.\n\n기대: 대시보드로 이동.",
			},
			{
				number: 40,
				title: "라우터를 파일 하나로 모으기",
				state: "open",
				labels: ["type:refactor"],
				author: "Hayoung0708",
				body: "라우트 정의가 세 군데 흩어져 있어 추가할 때마다 어디에 넣을지 매번 찾습니다.",
			},
			{
				number: 31,
				title: "i18n 로케일 키 동기화 검사",
				state: "closed",
				labels: ["type:chore"],
				author: "Hayoung0708",
				body: "로케일 파일 사이에 키가 어긋나도 아무도 모릅니다. CI에서 막습니다.",
			},
		],
		pulls: [
			{
				number: 45,
				title: "리다이렉트 루프 수정",
				state: "open",
				branch: "fix/login-redirect",
				ci: "pass",
				reviewer: "devxian96",
				body: "from 이 /login 일 때는 리다이렉트하지 않습니다.\n\nRef #42",
			},
			{
				number: 44,
				title: "라우터 모듈 추가",
				state: "draft",
				branch: "refactor/router",
				ci: "pending",
				body: "아직 라우트를 절반만 옮겼습니다.\n\nRef #40",
			},
		],
	},
	{
		id: "p2",
		name: "project_2",
		groupId: "login",
		branch: "develop",
		issues: [
			{
				number: 8,
				title: "API 토큰 주기적 교체",
				state: "open",
				labels: ["type:chore"],
				author: "devxian96",
				body: "토큰이 만료되면 배포가 조용히 실패합니다.",
			},
		],
		pulls: [],
	},
	{
		id: "p3",
		name: "project_3",
		groupId: "client-a",
		branch: "main",
		issues: [],
		pulls: [
			{
				number: 12,
				title: "CSV 내보내기",
				state: "open",
				branch: "feat/export-csv",
				ci: "fail",
				reviewer: "Hayoung0708",
				body: "cargo test 가 2개 실패합니다. 확인 중입니다.",
			},
		],
	},
	{
		id: "p4",
		name: "project_4",
		groupId: "client-a",
		branch: "release/2.1",
		issues: [],
		pulls: [],
	},
	{
		id: "p5",
		name: "project_5",
		groupId: "ungrouped",
		branch: "main",
		issues: [],
		pulls: [
			{
				number: 3,
				title: "Tauri 2.11 로 올리기",
				state: "merged",
				branch: "chore/bump-tauri",
				ci: "pass",
				reviewer: "devxian96",
				body: "패치 릴리스입니다. 변경 사항 없음.",
			},
		],
	},
];

// Real rows carry a hunk-relative identity; the fixtures synthesise the same so
// the renderer never keys on an array index.
export const mockSessions: Session[] = raw.map((session) => ({
	...session,
	files: session.files.map((file) => ({
		...file,
		rows: file.rows.map((row, index) => ({
			...row,
			id: `${file.path}:${index}`,
		})),
	})),
}));
