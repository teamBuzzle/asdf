import {
	ChevronDown,
	ChevronRight,
	File as FileIcon,
	Folder,
	FolderOpen,
	Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FileNode, FileStatus, Session } from "../types";

// Git status decides the colour, the way an editor's explorer does. Reading the
// tree should answer "what did the agent touch" before anything is clicked.
const statusTone: Record<FileStatus, string> = {
	clean: "",
	modified: "text-amber-600 dark:text-amber-500",
	added: "text-emerald-600 dark:text-emerald-500",
	deleted: "text-destructive line-through",
};

/** The file as text: its own source, or the after side of its diff. */
function fileText(session: Session, path: string): string[] {
	const source = session.sources[path];
	if (source) return source;
	const changed = session.files.find((file) => file.path === path);
	return (
		changed?.rows.flatMap((row) => (row.after ? [row.after.text] : [])) ?? []
	);
}

function collectFiles(nodes: FileNode[], into: string[] = []): string[] {
	for (const node of nodes) {
		if (node.kind === "file") into.push(node.path);
		else collectFiles(node.children, into);
	}
	return into;
}

type Hit = { path: string; line: number; text: string };

export function FileExplorer({
	session,
	onOpenFile,
}: {
	session: Session;
	onOpenFile: (sessionId: string, path: string) => void;
}) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

	const needle = query.trim().toLowerCase();

	// Searching a codebase means searching what is in the files, not only what
	// they are called, so a query swaps the tree for the matching lines.
	const hits = useMemo<Hit[]>(() => {
		if (!needle) return [];
		return collectFiles(session.tree).flatMap((path) =>
			fileText(session, path).flatMap((text, index) =>
				text.toLowerCase().includes(needle)
					? [{ path, line: index + 1, text }]
					: [],
			),
		);
	}, [session, needle]);

	const names = useMemo(
		() =>
			needle
				? collectFiles(session.tree).filter((path) =>
						path.toLowerCase().includes(needle),
					)
				: [],
		[session, needle],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="relative border-b p-2">
				<Search className="pointer-events-none absolute top-4.5 left-4 size-3.5 text-muted-foreground" />
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t("session.files.search")}
					aria-label={t("session.files.search")}
					className="h-8 bg-background/70 pl-7 text-xs"
				/>
			</div>

			<div className="flex-1 overflow-auto p-1">
				{needle ? (
					<Results
						names={names}
						hits={hits}
						needle={needle}
						onOpen={(path) => onOpenFile(session.id, path)}
					/>
				) : session.tree.length === 0 ? (
					<p className="px-2 py-3 text-muted-foreground text-xs">
						{t("session.files.empty")}
					</p>
				) : (
					<Tree
						nodes={session.tree}
						depth={0}
						closed={closed}
						onToggle={(path) =>
							setClosed((previous) => {
								const next = new Set(previous);
								if (!next.delete(path)) next.add(path);
								return next;
							})
						}
						onOpen={(path) => onOpenFile(session.id, path)}
					/>
				)}
			</div>
		</div>
	);
}

function Results({
	names,
	hits,
	needle,
	onOpen,
}: {
	names: string[];
	hits: Hit[];
	needle: string;
	onOpen: (path: string) => void;
}) {
	const { t } = useTranslation();
	if (names.length === 0 && hits.length === 0) {
		return (
			<p className="px-2 py-3 text-muted-foreground text-xs">
				{t("session.files.noMatch")}
			</p>
		);
	}

	const byFile = new Map<string, Hit[]>();
	for (const hit of hits) {
		const list = byFile.get(hit.path);
		if (list) list.push(hit);
		else byFile.set(hit.path, [hit]);
	}

	return (
		<div className="flex flex-col gap-2">
			{names.length > 0 && (
				<section>
					<h3 className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
						{t("session.files.byName", { n: names.length })}
					</h3>
					<ul>
						{names.map((path) => (
							<li key={path}>
								<button
									type="button"
									onClick={() => onOpen(path)}
									className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-accent/60"
								>
									<FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
									<span className="truncate">{path}</span>
								</button>
							</li>
						))}
					</ul>
				</section>
			)}

			{byFile.size > 0 && (
				<section>
					<h3 className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
						{t("session.files.byContent", { n: hits.length })}
					</h3>
					{[...byFile].map(([path, list]) => (
						<div key={path}>
							<p className="truncate px-2 py-1 font-medium text-[11px]">
								{path}
							</p>
							<ul>
								{list.map((hit) => (
									<li key={`${hit.path}:${hit.line}`}>
										<button
											type="button"
											onClick={() => onOpen(hit.path)}
											className="flex w-full items-baseline gap-2 rounded-md px-2 py-0.5 text-left hover:bg-accent/60"
										>
											<span className="w-6 shrink-0 text-right text-[10px] text-muted-foreground/60 tabular-nums">
												{hit.line}
											</span>
											<span className="min-w-0 flex-1 truncate font-mono text-[11px]">
												<Highlight text={hit.text} needle={needle} />
											</span>
										</button>
									</li>
								))}
							</ul>
						</div>
					))}
				</section>
			)}
		</div>
	);
}

function Highlight({ text, needle }: { text: string; needle: string }) {
	const at = text.toLowerCase().indexOf(needle);
	if (at === -1) return <>{text.trim()}</>;

	return (
		<>
			{text.slice(0, at).trimStart()}
			<mark className="rounded-xs bg-amber-400/40 text-inherit">
				{text.slice(at, at + needle.length)}
			</mark>
			{text.slice(at + needle.length)}
		</>
	);
}

function Tree({
	nodes,
	depth,
	closed,
	onToggle,
	onOpen,
}: {
	nodes: FileNode[];
	depth: number;
	closed: ReadonlySet<string>;
	onToggle: (path: string) => void;
	onOpen: (path: string) => void;
}) {
	return (
		<ul>
			{nodes.map((node) =>
				node.kind === "dir" ? (
					<li key={node.path}>
						<button
							type="button"
							aria-expanded={!closed.has(node.path)}
							onClick={() => onToggle(node.path)}
							style={{ paddingLeft: depth * 12 + 8 }}
							className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs hover:bg-accent/60"
						>
							{closed.has(node.path) ? (
								<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
							) : (
								<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
							)}
							{closed.has(node.path) ? (
								<Folder className="size-3.5 shrink-0 text-muted-foreground" />
							) : (
								<FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
							)}
							<span className="truncate">{node.name}</span>
						</button>
						{!closed.has(node.path) && (
							<Tree
								nodes={node.children}
								depth={depth + 1}
								closed={closed}
								onToggle={onToggle}
								onOpen={onOpen}
							/>
						)}
					</li>
				) : (
					<li key={node.path}>
						<button
							type="button"
							onClick={() => onOpen(node.path)}
							style={{ paddingLeft: depth * 12 + 25 }}
							className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs hover:bg-accent/60"
						>
							<FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
							<span className={cn("truncate", statusTone[node.status])}>
								{node.name}
							</span>
						</button>
					</li>
				),
			)}
		</ul>
	);
}
