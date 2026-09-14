export type Source = {
  file_path: string;
  similarity: number;
  start_offset: number;
  end_offset: number;
  start_line: number | null;
  end_line: number | null;
  content: string;
};

type UserMessage = { id: string; role: "user"; text: string };

export type AssistantMessage = {
  id: string;
  role: "assistant";
  text: string;
  sources: Source[];
  status: "streaming" | "done" | "failed";
  error: string | null;
};

export type ChatMessage = UserMessage | AssistantMessage;

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
