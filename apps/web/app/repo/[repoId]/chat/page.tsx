import { ChatScreen } from "@/components/chat-screen";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const { repoId } = await params;

  return <ChatScreen repoId={repoId} />;
}
