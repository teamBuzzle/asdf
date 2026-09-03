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
import type { FileNode, FileStatus } from "../types";

// Git status decides the colour, the way an editor's explorer does. Reading the
// tree should answer "what did I touch" before anything is clicked.
const statusTone: Record<FileStatus, string> = {
	clean: "",
	modified: "text-amber-600 dark:text-amber-500",
	added: "text-emerald-600 dark:text-emerald-500",
	deleted: "text-destructive line-through",
};

function collectFiles(nodes: FileNode[], into: string[] = []): string[] {
	for (const node of nodes) {
		if (node.kind === "file") into.push(node.path);
		else collectFiles(node.children, into);
	}
	return into;
}

export function FileExplorer({
	tree,
	onOpen,
}: {
	tree: FileNode[];
	onOpen: (path: string) => void;
}) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

	const needle = query.trim().toLowerCase();

	// ponytail: name search only. Content search means `git grep` over IPC;
	// add it when a name is not enough to find the file.
	const names = useMemo(
		() =>
			needle
				? collectFiles(tree).filter((path) =>
						path.toLowerCase().includes(needle),
					)
				: [],
		[tree, needle],
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
					names.length === 0 ? (
						<p className="px-2 py-3 text-muted-foreground text-xs">
							{t("session.files.noMatch")}
						</p>
					) : (
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
					)
				) : tree.length === 0 ? (
					<p className="px-2 py-3 text-muted-foreground text-xs">
						{t("session.files.empty")}
					</p>
				) : (
					<Tree
						nodes={tree}
						depth={0}
						closed={closed}
						onToggle={(path) =>
							setClosed((previous) => {
								const next = new Set(previous);
								if (!next.delete(path)) next.add(path);
								return next;
							})
						}
						onOpen={onOpen}
					/>
				)}
			</div>
		</div>
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
