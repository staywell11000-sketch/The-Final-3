import { supabase } from "./supabase"

// ─── Types ────────────────────────────────────────────────

export type Contact = {
  id: string
  user_id: string
  name: string
  phone: string | null
  email: string | null
  avatar_initials: string | null
  created_at: string
}

export type Conversation = {
  id: string
  user_id: string
  contact_id: string | null
  contact: Contact | null
  lead_id: number | null
  title: string | null
  status: "active" | "pending" | "resolved"
  channel: "crm" | "whatsapp"
  whatsapp_conversation_id: string | null
  linked_property: string | null
  last_message: string | null
  last_message_at: string
  unread_count: number
  created_at: string
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  type: "text" | "template" | "note"
  status: "sent" | "delivered" | "read"
  direction: "inbound" | "outbound"
  whatsapp_message_id: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────

function getBase(): string {
  return (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

// ─── Conversations ────────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*, contact:contacts(*)")
    .order("last_message_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as Conversation[]
}

export async function createConversation(
  userId: string,
  contactData: { name: string; phone?: string; email?: string; linked_property?: string }
): Promise<Conversation> {
  const initials = contactData.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const { data: contact, error: ce } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name: contactData.name,
      phone: contactData.phone || null,
      email: contactData.email || null,
      avatar_initials: initials,
    })
    .select()
    .single()

  if (ce) throw ce

  const { data: conv, error: ve } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      contact_id: contact.id,
      lead_id: null,
      channel: "crm",
      title: contactData.name,
      status: "active",
      linked_property: contactData.linked_property || null,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    })
    .select("*, contact:contacts(*)")
    .single()

  if (ve) throw ve
  return conv as Conversation
}

/**
 * Idempotent: returns an existing conversation for this lead_id,
 * or creates a new one. Guarantees no duplicates per lead.
 */
export async function getOrCreateConversationForLead(
  userId: string,
  lead: {
    id: number
    name: string
    phone?: string
    email?: string
    property?: string
  }
): Promise<Conversation> {
  const { data: existing, error: fe } = await supabase
    .from("conversations")
    .select("*, contact:contacts(*)")
    .eq("user_id", userId)
    .eq("lead_id", lead.id)
    .maybeSingle()

  if (fe) throw fe
  if (existing) return existing as Conversation

  const initials = lead.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const { data: contact, error: ce } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name: lead.name,
      phone: lead.phone || null,
      email: lead.email || null,
      avatar_initials: initials,
    })
    .select()
    .single()

  if (ce) throw ce

  const { data: conv, error: ve } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      contact_id: contact.id,
      lead_id: lead.id,
      channel: "crm",
      title: lead.name,
      status: "active",
      linked_property: lead.property || null,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    })
    .select("*, contact:contacts(*)")
    .single()

  if (ve) throw ve
  return conv as Conversation
}

export async function updateConversationStatus(
  id: string,
  status: "active" | "pending" | "resolved"
): Promise<void> {
  const { error } = await supabase.from("conversations").update({ status }).eq("id", id)
  if (error) throw error
}

// ─── Messages ─────────────────────────────────────────────

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as Message[]
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  type: "text" | "template" | "note" = "text",
  channel: "crm" | "whatsapp" = "crm"
): Promise<Message> {
  // Route WhatsApp messages through the API server
  if (channel === "whatsapp" && type !== "note") {
    const headers = await getAuthHeaders()
    const res = await fetch(`${getBase()}/api/whatsapp/send`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, content }),
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({})) as any
      throw new Error(errJson?.error ?? "Failed to send WhatsApp message")
    }

    const { message } = await res.json() as { message: Message }

    // Update conversation last_message client-side
    await supabase
      .from("conversations")
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq("id", conversationId)

    return message
  }

  // Standard CRM message — insert directly into Supabase
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      type,
      status: "sent",
      direction: "outbound",
    })
    .select()
    .single()

  if (error) throw error

  await supabase
    .from("conversations")
    .update({ last_message: content, last_message_at: new Date().toISOString() })
    .eq("id", conversationId)

  return data as Message
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await supabase.from("conversations").update({ unread_count: 0 }).eq("id", conversationId)
  await supabase
    .from("messages")
    .update({ status: "read" })
    .eq("conversation_id", conversationId)
    .neq("status", "read")
}

// ─── Helpers ──────────────────────────────────────────────

export function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()

  if (isYesterday)
    return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`

  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return `${diffDays}d ago`

  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}
