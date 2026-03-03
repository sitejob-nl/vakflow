import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMetaLeads } from "@/hooks/useMetaLeads";
import { useMetaConversations } from "@/hooks/useMetaConversations";
import { useMetaConfig } from "@/hooks/useMetaConfig";
import { useMetaPagePosts } from "@/hooks/useMetaPagePosts";
import { toast } from "@/hooks/use-toast";
import { Users, MessageSquare, Instagram, FileText, RefreshCw, UserPlus, Send, ThumbsUp, MessageCircle, Share2, Plus } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const statusColors: Record<string, string> = {
  nieuw: "bg-primary/10 text-primary",
  gecontacteerd: "bg-accent/50 text-accent-foreground",
  klant: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  genegeerd: "bg-muted text-muted-foreground",
};

const MarketingPage = () => {
  const { leadsQuery, updateStatus, convertToCustomer, fetchLeadDetails } = useMetaLeads();
  const { statusQuery } = useMetaConfig();
  const messengerConvos = useMetaConversations("messenger");
  const instagramConvos = useMetaConversations("instagram");
  const { postsQuery, fetchPosts, publishPost } = useMetaPagePosts();

  const [convertDialog, setConvertDialog] = useState<{ open: boolean; leadId: string; data: any }>({ open: false, leadId: "", data: {} });
  const [convertForm, setConvertForm] = useState({ name: "", email: "", phone: "" });
  const [replyDialog, setReplyDialog] = useState<{ open: boolean; senderId: string; platform: string }>({ open: false, senderId: "", platform: "" });
  const [replyText, setReplyText] = useState("");
  const [newPostDialog, setNewPostDialog] = useState(false);
  const [newPostText, setNewPostText] = useState("");

  const connected = statusQuery.data?.connected ?? false;

  const handleConvert = async () => {
    try {
      await convertToCustomer.mutateAsync({ leadId: convertDialog.leadId, ...convertForm });
      toast({ title: "Lead omgezet naar klant" });
      setConvertDialog({ open: false, leadId: "", data: {} });
      setConvertForm({ name: "", email: "", phone: "" });
    } catch {
      toast({ title: "Fout bij omzetten", variant: "destructive" });
    }
  };

  const handleReply = async () => {
    try {
      await messengerConvos.sendMessage.mutateAsync({
        recipient_id: replyDialog.senderId,
        message: replyText,
        platform: replyDialog.platform,
      });
      toast({ title: "Bericht verstuurd" });
      setReplyDialog({ open: false, senderId: "", platform: "" });
      setReplyText("");
    } catch {
      toast({ title: "Fout bij versturen", variant: "destructive" });
    }
  };

  const handlePublishPost = async () => {
    try {
      await publishPost.mutateAsync(newPostText);
      toast({ title: "Post gepubliceerd" });
      setNewPostDialog(false);
      setNewPostText("");
    } catch {
      toast({ title: "Fout bij publiceren", variant: "destructive" });
    }
  };

  const openConvertDialog = (lead: any) => {
    const cd = lead.customer_data || {};
    const fieldData = cd.field_data || [];
    const getName = (key: string) => fieldData.find((f: any) => f.name === key)?.values?.[0] || "";
    setConvertForm({
      name: getName("full_name") || getName("first_name") || "",
      email: getName("email") || "",
      phone: getName("phone_number") || "",
    });
    setConvertDialog({ open: true, leadId: lead.id, data: cd });
  };

  const renderMessages = (convos: any[], platform: string) => {
    if (!convos?.length) {
      return <p className="text-muted-foreground text-sm py-8 text-center">Geen berichten gevonden.</p>;
    }
    const grouped = convos.reduce((acc: Record<string, any[]>, msg: any) => {
      const key = msg.direction === "incoming" ? msg.sender_id : "outgoing";
      if (!acc[key]) acc[key] = [];
      acc[key].push(msg);
      return acc;
    }, {});

    return (
      <div className="space-y-3">
        {Object.entries(grouped).map(([senderId, messages]: [string, any[]]) => (
          <Card key={senderId}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {senderId === "outgoing" ? "Uitgaand" : (messages[0]?.sender_name || senderId)}
                </CardTitle>
                {senderId !== "outgoing" && (
                  <Button size="sm" variant="outline" onClick={() => setReplyDialog({ open: true, senderId, platform })}>
                    <Send className="w-3.5 h-3.5 mr-1" /> Beantwoorden
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1.5">
              {messages.slice(0, 5).map((msg: any) => (
                <div key={msg.id} className={`text-sm p-2 rounded ${msg.direction === "outgoing" ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}>
                  <p>{msg.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(msg.created_at), "d MMM HH:mm", { locale: nl })}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketing</h1>
          <p className="text-sm text-muted-foreground">Meta leads, Messenger & Instagram berichten</p>
        </div>
        {!connected && (
          <Badge variant="outline" className="border-destructive/30 text-destructive">
            Niet gekoppeld — configureer in Instellingen
          </Badge>
        )}
      </div>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads" className="gap-1.5"><Users className="w-4 h-4" /> Leads</TabsTrigger>
          <TabsTrigger value="messenger" className="gap-1.5"><MessageSquare className="w-4 h-4" /> Messenger</TabsTrigger>
          <TabsTrigger value="instagram" className="gap-1.5"><Instagram className="w-4 h-4" /> Instagram</TabsTrigger>
          <TabsTrigger value="page" className="gap-1.5"><FileText className="w-4 h-4" /> Pagina</TabsTrigger>
        </TabsList>

        {/* LEADS TAB */}
        <TabsContent value="leads">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Facebook Leads</CardTitle>
                <CardDescription>Inkomende leads vanuit Facebook/Instagram advertenties</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => leadsQuery.refetch()} disabled={leadsQuery.isRefetching}>
                <RefreshCw className={`w-4 h-4 mr-1 ${leadsQuery.isRefetching ? "animate-spin" : ""}`} /> Vernieuwen
              </Button>
            </CardHeader>
            <CardContent>
              {!leadsQuery.data?.length ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Nog geen leads ontvangen. Leads verschijnen hier automatisch wanneer je Meta App is gekoppeld en je advertenties leads genereren.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Formulier</TableHead>
                      <TableHead>Gegevens</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsQuery.data.map((lead: any) => {
                      const cd = lead.customer_data || {};
                      const fields = cd.field_data || [];
                      const summary = fields.map((f: any) => `${f.name}: ${f.values?.[0]}`).join(", ") || JSON.stringify(cd).slice(0, 80);
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(lead.created_at), "d MMM yyyy HH:mm", { locale: nl })}
                          </TableCell>
                          <TableCell className="text-sm">{lead.form_name || lead.form_id || "—"}</TableCell>
                          <TableCell className="text-sm max-w-[300px] truncate">{summary}</TableCell>
                          <TableCell>
                            <Select
                              value={lead.status}
                              onValueChange={(val) => updateStatus.mutate({ id: lead.id, status: val })}
                            >
                              <SelectTrigger className="w-[130px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(statusColors).map((s) => (
                                  <SelectItem key={s} value={s}>
                                    <Badge className={statusColors[s]} variant="secondary">{s}</Badge>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button size="sm" variant="ghost" onClick={() => fetchLeadDetails.mutate(lead.lead_id)}>
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            {lead.status !== "klant" && (
                              <Button size="sm" variant="outline" onClick={() => openConvertDialog(lead)}>
                                <UserPlus className="w-3.5 h-3.5 mr-1" /> Klant maken
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MESSENGER TAB */}
        <TabsContent value="messenger">
          <Card>
            <CardHeader>
              <CardTitle>Messenger berichten</CardTitle>
              <CardDescription>Facebook Messenger gesprekken</CardDescription>
            </CardHeader>
            <CardContent>
              {renderMessages(messengerConvos.conversationsQuery.data || [], "messenger")}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INSTAGRAM TAB */}
        <TabsContent value="instagram">
          <Card>
            <CardHeader>
              <CardTitle>Instagram DM's</CardTitle>
              <CardDescription>Instagram Direct Messages</CardDescription>
            </CardHeader>
            <CardContent>
              {renderMessages(instagramConvos.conversationsQuery.data || [], "instagram")}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAGE TAB */}
        <TabsContent value="page">
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Facebook Pagina Posts</CardTitle>
                  <CardDescription>Overzicht van je pagina-posts met engagement</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fetchPosts.mutate()} disabled={fetchPosts.isPending}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${fetchPosts.isPending ? "animate-spin" : ""}`} /> Ophalen
                  </Button>
                  <Button size="sm" onClick={() => setNewPostDialog(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Nieuw bericht
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!postsQuery.data?.length ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">
                    Geen posts gevonden. Klik op "Ophalen" om je recente pagina-posts te synchroniseren vanuit Facebook.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {postsQuery.data.map((post: any) => (
                      <div key={post.id} className="border border-border rounded-lg p-4">
                        <p className="text-sm mb-2">{post.message || <span className="text-muted-foreground italic">Geen tekst</span>}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {post.created_time && (
                            <span>{format(new Date(post.created_time), "d MMM yyyy HH:mm", { locale: nl })}</span>
                          )}
                          <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> {post.likes ?? 0}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {post.comments ?? 0}</span>
                          <span className="flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> {post.shares ?? 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Convert Dialog */}
      <Dialog open={convertDialog.open} onOpenChange={(o) => !o && setConvertDialog({ open: false, leadId: "", data: {} })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead omzetten naar klant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Naam</Label><Input value={convertForm.name} onChange={(e) => setConvertForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>E-mail</Label><Input value={convertForm.email} onChange={(e) => setConvertForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Telefoon</Label><Input value={convertForm.phone} onChange={(e) => setConvertForm((f) => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleConvert} disabled={!convertForm.name || convertToCustomer.isPending}>
              <UserPlus className="w-4 h-4 mr-1" /> Klant aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={replyDialog.open} onOpenChange={(o) => !o && setReplyDialog({ open: false, senderId: "", platform: "" })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bericht sturen</DialogTitle></DialogHeader>
          <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Typ je bericht..." rows={4} />
          <DialogFooter>
            <Button onClick={handleReply} disabled={!replyText.trim() || messengerConvos.sendMessage.isPending}>
              <Send className="w-4 h-4 mr-1" /> Versturen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Post Dialog */}
      <Dialog open={newPostDialog} onOpenChange={setNewPostDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nieuw bericht publiceren</DialogTitle></DialogHeader>
          <Textarea value={newPostText} onChange={(e) => setNewPostText(e.target.value)} placeholder="Schrijf je bericht..." rows={5} />
          <DialogFooter>
            <Button onClick={handlePublishPost} disabled={!newPostText.trim() || publishPost.isPending}>
              <Send className="w-4 h-4 mr-1" /> Publiceren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketingPage;
