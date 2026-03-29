import { useState, useCallback } from "react";
import {
  Mail, Send, Loader2, Users, UserCheck,
  Bold, Italic, Underline as UnderlineIcon, Link2, List, ListOrdered,
  Heading2, Undo, Redo, Strikethrough,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminUsers, sendAdminEmail, AdminUser } from "@/lib/api";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

// ---------------------------------------------------------------------------
// Toolbar Button
// ---------------------------------------------------------------------------
function ToolbarBtn({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        active
          ? "bg-primary/20 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
const AdminEmailPage = () => {
  const [subject, setSubject] = useState("");
  const [recipientType, setRecipientType] = useState<"all" | "selected">("selected");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-email"],
    queryFn: () => fetchAdminUsers(),
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { style: "color:#6366f1;text-decoration:underline;" },
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-invert max-w-none min-h-[250px] px-4 py-3 outline-none focus:outline-none [&_p]:my-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline",
      },
    },
  });

  const filteredUsers = users.filter(
    (u) =>
      !userSearch ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.full_name.toLowerCase().includes(userSearch.toLowerCase())
  );

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedUserIds(users.map((u) => u.id));
  const deselectAll = () => setSelectedUserIds([]);

  const recipientCount =
    recipientType === "all" ? users.filter((u) => u.is_active).length : selectedUserIds.length;

  const setLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkDialogOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const openLinkDialog = () => {
    if (!editor) return;
    const existingHref = editor.getAttributes("link").href;
    setLinkUrl(existingHref || "");
    setLinkDialogOpen(true);
  };

  const handleSendClick = () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject.");
      return;
    }
    if (!editor || editor.isEmpty) {
      toast.error("Please write the email content.");
      return;
    }
    if (recipientType === "selected" && selectedUserIds.length === 0) {
      toast.error("Please select at least one recipient.");
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!editor) return;
    setConfirmOpen(false);
    setSending(true);
    try {
      const res = await sendAdminEmail({
        subject: subject.trim(),
        html_body: editor.getHTML(),
        recipient_type: recipientType,
        user_ids: recipientType === "selected" ? selectedUserIds : undefined,
      });
      toast.success(res.detail);
      // Reset form
      setSubject("");
      editor.commands.clearContent();
      setSelectedUserIds([]);
    } catch {
      toast.error("Failed to send email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-t-2xl p-8 bg-primary">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 50%)" }} />
        <div className="absolute inset-0 header-diamond-pattern pointer-events-none" />
        <div className="relative z-20 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
            <Mail className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Send Email</h1>
            <p className="text-white/60 text-sm mt-0.5">Compose and send emails to users</p>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Compose */}
        <div className="lg:col-span-2 space-y-4">
          {/* Subject */}
          <div className="glass-card p-5 space-y-3">
            <Label className="text-xs font-bold text-muted-foreground uppercase">Subject</Label>
            <Input
              placeholder="Email subject line..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          {/* Rich Text Editor */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-2 border-b border-white/5 flex items-center gap-0.5 flex-wrap">
              {editor && (
                <>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
                    <Bold className="h-4 w-4" />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
                    <Italic className="h-4 w-4" />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
                    <Strikethrough className="h-4 w-4" />
                  </ToolbarBtn>
                  <div className="w-px h-5 bg-white/10 mx-1" />
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading">
                    <Heading2 className="h-4 w-4" />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
                    <List className="h-4 w-4" />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List">
                    <ListOrdered className="h-4 w-4" />
                  </ToolbarBtn>
                  <div className="w-px h-5 bg-white/10 mx-1" />
                  <ToolbarBtn onClick={openLinkDialog} active={editor.isActive("link")} title="Add Link">
                    <Link2 className="h-4 w-4" />
                  </ToolbarBtn>
                  <div className="w-px h-5 bg-white/10 mx-1" />
                  <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
                    <Undo className="h-4 w-4" />
                  </ToolbarBtn>
                  <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
                    <Redo className="h-4 w-4" />
                  </ToolbarBtn>
                </>
              )}
            </div>
            <EditorContent editor={editor} />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSendClick}
            disabled={sending}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-white shadow-lg text-base"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
            {sending ? "Sending..." : "Send Email"}
          </Button>
        </div>

        {/* Right — Recipients */}
        <div className="space-y-4">
          {/* Recipient type toggle */}
          <div className="glass-card p-4">
            <Label className="text-xs font-bold text-muted-foreground uppercase mb-3 block">Recipients</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setRecipientType("selected")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                  recipientType === "selected"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted/20 text-muted-foreground border border-transparent hover:bg-muted/40"
                }`}
              >
                <UserCheck className="h-4 w-4" /> Selected
              </button>
              <button
                onClick={() => setRecipientType("all")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                  recipientType === "all"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted/20 text-muted-foreground border border-transparent hover:bg-muted/40"
                }`}
              >
                <Users className="h-4 w-4" /> All Users
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {recipientType === "all"
                ? `Will send to all ${users.filter((u) => u.is_active).length} active users`
                : `${selectedUserIds.length} user${selectedUserIds.length !== 1 ? "s" : ""} selected`}
            </p>
          </div>

          {/* User picker (only for 'selected') */}
          {recipientType === "selected" && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Select Users</Label>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[10px] text-primary hover:underline">Select All</button>
                  <button onClick={deselectAll} className="text-[10px] text-muted-foreground hover:underline">Clear</button>
                </div>
              </div>
              <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-9 text-xs"
              />
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        isSelected
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/30 border border-transparent"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && (
                          <svg viewBox="0 0 12 12" className="h-3 w-3 text-white fill-current">
                            <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{user.full_name || user.username}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </button>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Send Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Send className="h-4 w-4 text-white" />
              </div>
              Confirm Send Email
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              You are about to send this email to <strong className="text-foreground">{recipientCount} recipient{recipientCount !== 1 ? "s" : ""}</strong>.
            </p>
            <div className="rounded-lg bg-muted/20 border border-border/30 p-3">
              <p className="text-xs text-muted-foreground uppercase font-bold">Subject</p>
              <p className="text-sm font-medium text-foreground mt-1">{subject}</p>
            </div>
            <p className="text-sm text-muted-foreground">Are you sure you want to proceed?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmSend} className="bg-primary hover:bg-primary/90 text-white">
              Yes, Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase">URL</Label>
            <Input
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setLink(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            {editor?.isActive("link") && (
              <Button variant="destructive" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkDialogOpen(false); }}>
                Remove Link
              </Button>
            )}
            <Button onClick={setLink}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailPage;
