import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuestListTab } from "@/components/painel/GuestListTab";
import { GuestSignupsCard } from "@/components/painel/GuestSignupsCard";
import { CoOwnersCard } from "@/components/admin/CoOwnersCard";

export function GuestsWorkspace({ weddingId }: { weddingId: string | null }) {
  if (!weddingId) return null;
  return (
    <Tabs defaultValue="lista">
      <TabsList className="sticky top-16 z-20 grid h-auto w-full grid-cols-4 bg-background">
        <TabsTrigger value="lista">Lista</TabsTrigger>
        <TabsTrigger value="convites">Convites</TabsTrigger>
        <TabsTrigger value="perfis">Perfis</TabsTrigger>
        <TabsTrigger value="acessos">Acessos</TabsTrigger>
      </TabsList>
      <TabsContent value="lista"><GuestListTab weddingId={weddingId} mode="list" /></TabsContent>
      <TabsContent value="convites"><GuestListTab weddingId={weddingId} mode="invites" /></TabsContent>
      <TabsContent value="perfis"><GuestSignupsCard weddingId={weddingId} /></TabsContent>
      <TabsContent value="acessos"><CoOwnersCard weddingId={weddingId} /></TabsContent>
    </Tabs>
  );
}