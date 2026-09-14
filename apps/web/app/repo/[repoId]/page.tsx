import { IndexingScreen } from "@/components/indexing-screen";
import { TopBar } from "@/components/top-bar";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const { repoId } = await params;

  return (
    <>
      <TopBar />
      <main className="flex flex-1 flex-col items-center px-6 pt-24 pb-24">
        <IndexingScreen repoId={repoId} />
      </main>
    </>
  );
}
